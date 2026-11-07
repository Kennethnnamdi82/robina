package com.venomee.rivalsheist;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

/** Auth-only bridge. Session cookies and PKCE verifiers never enter JavaScript,
 * URLs, logs, localStorage, WebView cookies, Android backups or APK resources. */
@CapacitorPlugin(name="RivalsSession")
public class RivalsSessionPlugin extends Plugin {
    private static final String ORIGIN="https://rivals-heist.vercel.app";
    private static final String KEY_ALIAS="rivals.session.aes.v1";
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private boolean focused=false;
    private final AudioManager.OnAudioFocusChangeListener focusListener=change->{
        if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK){focused=false;notifyListeners("audioInterrupted",new JSObject());}
    };
    private void audioFocus(boolean playing){
        if(audioManager==null)audioManager=(AudioManager)getContext().getSystemService(Context.AUDIO_SERVICE);
        if(playing&&!focused){
            int result;
            if(Build.VERSION.SDK_INT>=26){
                if(focusRequest==null)focusRequest=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setOnAudioFocusChangeListener(focusListener).build();
                result=audioManager.requestAudioFocus(focusRequest);
            }else result=audioManager.requestAudioFocus(focusListener,AudioManager.STREAM_MUSIC,AudioManager.AUDIOFOCUS_GAIN);
            focused=result==AudioManager.AUDIOFOCUS_REQUEST_GRANTED;if(!focused)notifyListeners("audioInterrupted",new JSObject());
        }else if(!playing){if(Build.VERSION.SDK_INT>=26&&focusRequest!=null)audioManager.abandonAudioFocusRequest(focusRequest);else audioManager.abandonAudioFocus(focusListener);focused=false;}
    }
    private SharedPreferences preferences(){return getContext().getSharedPreferences("rivals_private_session",Context.MODE_PRIVATE);}
    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(KEY_ALIAS))return (SecretKey)store.getKey(KEY_ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setKeySize(256).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private void put(String name,String value) throws Exception {
        if(value==null||value.isEmpty()){preferences().edit().remove(name).commit();return;}
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        byte[] iv=cipher.getIV(),encrypted=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),all=new byte[iv.length+encrypted.length];
        System.arraycopy(iv,0,all,0,iv.length);System.arraycopy(encrypted,0,all,iv.length,encrypted.length);
        if(!preferences().edit().putString(name,Base64.encodeToString(all,Base64.NO_WRAP)).commit())throw new IllegalStateException("Secure storage unavailable");
    }
    private String get(String name){
        try{
            String value=preferences().getString(name,"");if(value.isEmpty())return "";
            byte[] all=Base64.decode(value,Base64.NO_WRAP);if(all.length<29)throw new IllegalStateException();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(all,0,12)));
            return new String(cipher.doFinal(all,12,all.length-12),StandardCharsets.UTF_8);
        }catch(Exception ignored){preferences().edit().remove(name).commit();return "";}
    }
    private String random(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.encodeToString(bytes,Base64.URL_SAFE|Base64.NO_PADDING|Base64.NO_WRAP);}
    private JSObject send(String path,String method,String body) throws Exception {
        HttpsURLConnection connection=(HttpsURLConnection)new URL(ORIGIN+path).openConnection();
        connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestMethod(method);
        connection.setRequestProperty("Accept","application/json");connection.setRequestProperty("Origin",ORIGIN);
        connection.setRequestProperty("User-Agent","RIVALS-Android/"+BuildConfig.VERSION_NAME);
        String session=get("session");if(!session.isEmpty())connection.setRequestProperty("Cookie","bd_session="+session);
        try{
            if(method.equals("POST")){byte[] bytes=(body==null?"{}":body).getBytes(StandardCharsets.UTF_8);if(bytes.length>65536)throw new IllegalArgumentException("Request too large");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setFixedLengthStreamingMode(bytes.length);try(var output=connection.getOutputStream()){output.write(bytes);}}
            int status=connection.getResponseCode();if(status>=300&&status<400)throw new IllegalStateException("Unexpected authentication redirect");
            for(Map.Entry<String,List<String>> header:connection.getHeaderFields().entrySet()){
                if(header.getKey()!=null&&header.getKey().equalsIgnoreCase("Set-Cookie"))for(String cookie:header.getValue()){
                    if(!cookie.startsWith("bd_session="))continue;
                    String token=cookie.substring(11).split(";",2)[0];if(token.length()>8192||!token.matches("[A-Za-z0-9_.-]*"))throw new IllegalStateException("Invalid session response");put("session",token);
                }
            }
            if(status==401&&path.equals("/api/auth/me"))put("session","");
            InputStream input=status>=400?connection.getErrorStream():connection.getInputStream();String text="{}";
            if(input!=null)try(input;ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] chunk=new byte[4096];int count;while((count=input.read(chunk))!=-1){if(output.size()+count>65536)throw new IllegalStateException("Authentication response too large");output.write(chunk,0,count);}text=output.toString(StandardCharsets.UTF_8.name());
            }
            JSObject response=new JSObject();response.put("status",status);response.put("data",new JSObject(text));return response;
        }finally{connection.disconnect();}
    }
    @PluginMethod public void request(PluginCall call){
        String path=call.getString("path",""),method=call.getString("method","GET");
        if(!NativeSessionPolicy.allowedClientRequest(path,method)){call.reject("Unsupported native operation");return;}
        executor.execute(()->{try{if(path.endsWith("/me")&&get("session").isEmpty()){JSObject empty=new JSObject();empty.put("status",401);empty.put("data",new JSObject("{\"error\":\"unauthenticated\"}"));call.resolve(empty);return;}JSObject result=send(path,method,call.getString("body","{}"));if(path.endsWith("/logout")&&result.getInteger("status",0)==200){put("session","");put("pending","");}call.resolve(result);}catch(Exception ignored){call.reject("Authentication service unavailable — check your connection");}});
    }
    @PluginMethod public void beginLogin(PluginCall call){
        executor.execute(()->{try{
            String verifier=random(),state=random(),challenge=Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8)),Base64.URL_SAFE|Base64.NO_PADDING|Base64.NO_WRAP);
            JSONObject pending=new JSONObject();pending.put("verifier",verifier);pending.put("state",state);pending.put("expires",System.currentTimeMillis()+180000);put("pending",pending.toString());
            JSObject result=new JSObject();result.put("url",ORIGIN+"/native-sign-in?challenge="+challenge+"&state="+state);call.resolve(result);
        }catch(Exception ignored){call.reject("Secure sign-in could not start");}});
    }
    @PluginMethod public void cancelLogin(PluginCall call){
        executor.execute(()->{try{put("pending","");call.resolve();}catch(Exception ignored){call.reject("Could not clear pending sign-in");}});
    }
    @PluginMethod public void completeLogin(PluginCall call){
        String url=call.getString("url","");
        executor.execute(()->{try{
            Uri uri=Uri.parse(url);String code=uri.getQueryParameter("code"),state=uri.getQueryParameter("state");
            if(!NativeSessionPolicy.allowedReturnUrl(url)||!NativeSessionPolicy.validParameter(code)||!NativeSessionPolicy.validParameter(state))throw new IllegalArgumentException();
            JSONObject pending=new JSONObject(get("pending"));
            if(pending.getLong("expires")<System.currentTimeMillis()||!MessageDigest.isEqual(state.getBytes(StandardCharsets.UTF_8),pending.getString("state").getBytes(StandardCharsets.UTF_8)))throw new IllegalArgumentException();
            JSONObject body=new JSONObject();body.put("code",code);body.put("verifier",pending.getString("verifier"));
            JSObject result=send("/api/auth/native/exchange","POST",body.toString());int status=result.getInteger("status",0);
            if(status==200||status==400||status==401||status==403)put("pending","");call.resolve(result);
        }catch(Exception ignored){call.reject("Sign-in return could not be verified — please retry from the game");}});
    }
    @PluginMethod public void setGameplay(PluginCall call){
        boolean active=Boolean.TRUE.equals(call.getBoolean("active",false)),playing=Boolean.TRUE.equals(call.getBoolean("playing",false));
        getActivity().runOnUiThread(()->{
            WindowInsetsControllerCompat controller=WindowCompat.getInsetsController(getActivity().getWindow(),getActivity().getWindow().getDecorView());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            if(active)controller.hide(WindowInsetsCompat.Type.systemBars());else controller.show(WindowInsetsCompat.Type.systemBars());
            getActivity().getWindow().getDecorView().setKeepScreenOn(playing);audioFocus(playing);call.resolve();
        });
    }
    @Override protected void handleOnPause(){audioFocus(false);super.handleOnPause();}
    @Override protected void handleOnDestroy(){audioFocus(false);executor.shutdown();super.handleOnDestroy();}
}

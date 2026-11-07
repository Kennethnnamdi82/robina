import type {CapacitorConfig} from '@capacitor/cli';

const config:CapacitorConfig={
  appId:'com.venomee.rivalsheist',appName:'RIVALS: RIVAL HEIST',webDir:'dist',
  backgroundColor:'#0c1012',
  android:{allowMixedContent:false,backgroundColor:'#0c1012',webContentsDebuggingEnabled:false,captureInput:true},
  server:{androidScheme:'https',hostname:'localhost',cleartext:false},
  plugins:{SystemBars:{style:'DARK',insetsHandling:'css',initialViewportFitValueHint:'cover'}},
  // No server.url: all game code, models, textures and audio ship in the APK
};
export default config;

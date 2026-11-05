export function MissionLoading({progress,title,message,onCancel}:{progress:number;title:string;message:string;onCancel:()=>void}){
  const percentage=Math.min(100,Math.max(10,Math.round(progress*100)));
  return <section className="r3-mission-loading" aria-label="Mission preparation"><div className="r3-loading-art"/><div className="r3-loading-content"><span>RIVALS / OPERATIONS COMMAND</span><h1>{title}</h1><p role="status">{message}</p><div className="r3-loading-meter" role="progressbar" aria-label="Mission loading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}><i style={{width:percentage+'%'}}/></div><output>{percentage}%</output><small>Your mission starts when the city is ready</small><button onClick={onCancel}>CANCEL INSERTION</button></div></section>;
}

export default function CommandLoading({message}:{message:string}){
  return <main className="command-loading"><span>RIVALS / OPERATIONS COMMAND</span><h1>Welcome to RIVALS</h1><p role="status">{message}</p><i aria-hidden="true"/><small>ESTABLISHING YOUR CONNECTION</small></main>;
}

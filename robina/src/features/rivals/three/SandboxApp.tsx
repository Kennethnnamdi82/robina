import RaidApp from './RaidApp';

/** The isolated, account-free test entry remains development-only. */
export default function SandboxApp() {
  if (!import.meta.env.DEV || import.meta.env.VITE_RIVALS_3D_SANDBOX !== 'true') {
    return <p>Development sandbox disabled.</p>;
  }
  return <RaidApp development />;
}

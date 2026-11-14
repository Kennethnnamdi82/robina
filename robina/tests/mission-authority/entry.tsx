import {createRoot} from 'react-dom/client';
import RaidApp from '../../src/features/rivals/three/RaidApp';
import {createAssignmentOperation} from '../../src/features/rivals/three/Operations';
import {defaultHubPreferences} from '../../src/features/rivals/hub/model';
createRoot(document.getElementById('root')!).render(<RaidApp operation={createAssignmentOperation(0,42)} preferences={{...defaultHubPreferences(),quality:'low',muted:true}}/>);

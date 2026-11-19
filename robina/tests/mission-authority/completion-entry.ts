import {LocalMission} from '../../src/services/localMission';
import {unpackReplayInput} from '../../src/features/rivals/authority/MissionReplay';
import {pendingMissions} from '../../src/services/missionCompletion';
Object.assign(window,{completionTools:{LocalMission,unpackReplayInput,pendingMissions}});

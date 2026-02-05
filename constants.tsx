
import { Role } from './types';

export const ROLES: { [id: string]: Role } = {
  village: { id: 'village', name: '村人', description: '特別な能力はありません。', team: 'VILLAGER', sideDescription: '村人陣営' },
  wolf: { id: 'wolf', name: '人狼', description: '夜に一人を襲撃します。仲間と「人狼チャット」で相談可能です。', team: 'WEREWOLF', sideDescription: '人狼陣営' },
  seer: { id: 'seer', name: '占い師', description: '夜に一人を占い、人狼かどうかを知ることができます。', team: 'VILLAGER', sideDescription: '村人陣営' },
  knight: { id: 'knight', name: '騎士', description: '夜に一人を護衛し、人狼の襲撃から守ります。', team: 'VILLAGER', sideDescription: '村人陣営' },
  medium: { id: 'medium', name: '霊媒師', description: '前日に処刑された人が人狼だったかを知ることができます。', team: 'VILLAGER', sideDescription: '村人陣営' },
  madman: { id: 'madman', name: '狂人', description: '人狼の味方ですが、占いや霊媒では村人と判定されます。', team: 'WEREWOLF', sideDescription: '人狼陣営' },
  fox: { id: 'fox', name: '妖狐', description: '襲撃されても死にませんが、占われると死にます。最後まで生存すれば単独勝利です。', team: 'FOX', sideDescription: '妖狐陣営' },
  immoral: { id: 'immoral', name: '背徳者', description: '妖狐の味方です。妖狐が全員いなくなると後を追って死亡します。', team: 'FOX', sideDescription: '妖狐陣営' },
  mason: { id: 'mason', name: '共有者', description: '共有者同士、互いを確認できます。', team: 'VILLAGER', sideDescription: '村人陣営' },
  baker: { id: 'baker', name: 'パン屋', description: '生きている間、毎朝パンを焼いて村に活気を与えます。', team: 'VILLAGER', sideDescription: '村人陣営' },
};

export const TEMPLATES: { [count: number]: { [roleId: string]: number } } = {
  5: { wolf: 1, seer: 1, knight: 1, baker: 1, village: 1 },
  6: { wolf: 1, seer: 1, knight: 1, madman: 1, fox: 1, baker: 1 },
  7: { wolf: 2, seer: 1, knight: 1, fox: 1, immoral: 1, baker: 1, village: 0 },
  8: { wolf: 2, seer: 1, knight: 1, madman: 1, fox: 1, immoral: 1, baker: 1, village: 0 },
  9: { wolf: 2, seer: 1, medium: 1, knight: 1, madman: 1, fox: 1, immoral: 1, baker: 1, village: 0 },
  10: { wolf: 2, seer: 1, medium: 1, knight: 1, madman: 1, fox: 1, immoral: 1, mason: 2, baker: 1 },
  11: { wolf: 3, seer: 1, medium: 1, knight: 1, madman: 1, fox: 1, immoral: 1, mason: 2, baker: 1, village: 0 },
  12: { wolf: 3, seer: 1, medium: 1, knight: 1, madman: 1, fox: 1, immoral: 1, mason: 2, village: 1, baker: 1 },
};

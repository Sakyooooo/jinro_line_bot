
export type Team = 'VILLAGER' | 'WEREWOLF' | 'FOX' | 'OTHER';

export interface Role {
  id: string;
  name: string;
  description: string;
  team: Team;
  sideDescription: string;
}

export type Phase = 'LOBBY' | 'SETUP' | 'START' | 'NIGHT' | 'MORNING' | 'DAY' | 'VOTE' | 'REVOTE' | 'EXECUTE' | 'RESULT';

export type ChatChannel = 'GLOBAL' | 'DEAD' | 'WOLVES' | 'BOT_DM';

export type ScreenState = 'HOME' | 'CREATE' | 'JOIN' | 'GAME';

export interface Message {
  id: string;
  senderId: string; // 'bot' or player.id
  senderName: string;
  content: string;
  timestamp: number;
  channel: ChatChannel;
  recipientId?: string; // For BOT_DM
}

export interface Player {
  id: string;
  name: string;
  roleId: string;
  isAlive: boolean;
  isHost: boolean;
  isNPC: boolean;
  nightActionTarget?: string;
  voteTarget?: string;
  hasActed: boolean;
  skipAgreed: boolean;
  deathReason?: string;
}

export interface GameState {
  roomId: string;
  roomName: string;
  passcode: string;
  passcodeHash: string;
  phase: Phase;
  day: number;
  players: Player[];
  messages: Message[];
  timer: number;
  roleConfig: { [roleId: string]: number };
  winner?: Team | 'DRAW';
  lastExecutedPlayerId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  roomId?: string;
}

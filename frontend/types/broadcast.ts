export type BroadcastTargetGroup = 'all' | 'workers' | 'supervisors' | 'site';

export interface BroadcastLog {
  id: string;
  organizationId: string;
  title: string;
  message: string;
  category: 'holiday' | 'safety' | 'event' | 'payment' | 'general';
  targetGroup: BroadcastTargetGroup;
  siteId?: string;
  siteName?: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  sentAt: any;
  sentBy?: string;
}

export interface BroadcastPresetTemplate {
  id: string;
  title: string;
  category: 'holiday' | 'safety' | 'event' | 'payment' | 'general';
  icon: string;
  defaultTitle: string;
  defaultMessage: string;
}

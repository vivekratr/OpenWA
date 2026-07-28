import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2, Send } from 'lucide-react';
import { scheduledMessageApi, type ScheduledMessageStatus } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { useToast } from '../components/Toast';
import './ScheduledMessages.css';

const messageTypes = ['text', 'image', 'video', 'audio', 'document'] as const;

function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduledMessages() {
  const { t } = useTranslation();
  useDocumentTitle(t('scheduledMessages.title'));
  const { canWrite } = useRole();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const sessions = allSessions.filter(s => s.status === 'ready');

  const [session, setSession] = useState('');
  const [scheduledAtLocal, setScheduledAtLocal] = useState('');
  const [recipientsRaw, setRecipientsRaw] = useState('');
  const [messageType, setMessageType] = useState<typeof messageTypes[number]>('text');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (sessions.length > 0 && !session) {
      setSession(sessions[0].id);
    }
  }, [sessions, session]);

  useEffect(() => {
    const defaultDate = new Date(Date.now() + 5 * 60 * 1000);
    setScheduledAtLocal(toLocalDatetimeValue(defaultDate));
  }, []);

  const { data: scheduledData, isLoading: loadingScheduled } = useQuery({
    queryKey: ['scheduled-messages', session],
    queryFn: () => scheduledMessageApi.list(session, { limit: 50 }),
    enabled: !!session,
    refetchInterval: 30_000,
  });

  const recipients = useMemo(() => parseRecipients(recipientsRaw), [recipientsRaw]);

  const handleSchedule = async () => {
    if (!session || !scheduledAtLocal || recipients.length === 0) return;

    const scheduledAt = new Date(scheduledAtLocal);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error(t('scheduledMessages.invalidDate'));
      return;
    }

    setIsSubmitting(true);
    try {
      let messageContent: Record<string, unknown>;
      if (messageType === 'text') {
        messageContent = { text: content };
      } else if (messageType === 'image') {
        messageContent = { image: { url: mediaUrl }, caption: content || undefined };
      } else if (messageType === 'video') {
        messageContent = { video: { url: mediaUrl }, caption: content || undefined };
      } else if (messageType === 'audio') {
        messageContent = { audio: { url: mediaUrl } };
      } else {
        messageContent = { document: { url: mediaUrl, filename: content || undefined } };
      }

      await scheduledMessageApi.create(session, {
        scheduledAt: scheduledAt.toISOString(),
        recipients,
        messageType,
        content: messageContent,
      });

      toast.success(t('scheduledMessages.scheduleSuccess'));
      setRecipientsRaw('');
      setContent('');
      setMediaUrl('');
      await queryClient.invalidateQueries({ queryKey: ['scheduled-messages', session] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('scheduledMessages.scheduleFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!session) return;
    try {
      await scheduledMessageApi.cancel(session, id);
      toast.success(t('scheduledMessages.cancelSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['scheduled-messages', session] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('scheduledMessages.cancelFailed'));
    }
  };

  const canCancel = (status: ScheduledMessageStatus) => status === 'pending' || status === 'queued';

  if (loadingSessions) {
    return (
      <div
        className="scheduled-messages"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="scheduled-messages">
      <PageHeader title={t('scheduledMessages.title')} subtitle={t('scheduledMessages.subtitle')} />

      <div className="queue-hint">{t('scheduledMessages.queueHint')}</div>

      <div className="scheduled-panels">
        <div className="compose-panel">
          <h2>{t('scheduledMessages.compose')}</h2>

          <div className="form-group">
            <label>{t('scheduledMessages.session')}</label>
            <select value={session} onChange={e => setSession(e.target.value)}>
              {sessions.length === 0 && <option value="">{t('scheduledMessages.noReadySessions')}</option>}
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.phone || t('scheduledMessages.sessionOptionPhoneNone')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{t('scheduledMessages.scheduledAt')}</label>
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={e => setScheduledAtLocal(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>{t('scheduledMessages.recipients')}</label>
            <textarea
              rows={4}
              value={recipientsRaw}
              onChange={e => setRecipientsRaw(e.target.value)}
              placeholder={t('scheduledMessages.recipientsPlaceholder')}
            />
            <small>{t('scheduledMessages.recipientCount', { count: recipients.length })}</small>
          </div>

          <div className="form-group">
            <label>{t('scheduledMessages.messageType')}</label>
            <select value={messageType} onChange={e => setMessageType(e.target.value as typeof messageTypes[number])}>
              {messageTypes.map(type => (
                <option key={type} value={type}>
                  {t(`messageTester.types.${type}`)}
                </option>
              ))}
            </select>
          </div>

          {messageType === 'text' ? (
            <div className="form-group">
              <label>{t('scheduledMessages.messageContent')}</label>
              <textarea
                rows={4}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={t('messageTester.messagePlaceholder')}
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>{t('messageTester.mediaUrl')}</label>
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/file.jpg"
                />
              </div>
              {messageType !== 'audio' && (
                <div className="form-group">
                  <label>
                    {messageType === 'document' ? t('messageTester.filename') : t('messageTester.caption')} (
                    {t('common.optional')})
                  </label>
                  <input
                    type="text"
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder={
                      messageType === 'document'
                        ? t('messageTester.filenamePlaceholder')
                        : t('messageTester.captionPlaceholder')
                    }
                  />
                </div>
              )}
            </>
          )}

          <button
            className="send-btn"
            onClick={handleSchedule}
            disabled={
              !canWrite ||
              isSubmitting ||
              !session ||
              recipients.length === 0 ||
              (messageType === 'text' ? !content.trim() : !mediaUrl.trim())
            }
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <CalendarClock size={18} />}
            {isSubmitting ? t('scheduledMessages.scheduling') : t('scheduledMessages.schedule')}
          </button>
        </div>

        <div className="list-panel">
          <h2>{t('scheduledMessages.upcoming')}</h2>

          {loadingScheduled ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : scheduledData && scheduledData.data.length > 0 ? (
            <table className="scheduled-table">
              <thead>
                <tr>
                  <th>{t('scheduledMessages.table.when')}</th>
                  <th>{t('scheduledMessages.table.recipients')}</th>
                  <th>{t('common.status')}</th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {scheduledData.data.map(item => (
                  <tr key={item.id}>
                    <td>{new Date(item.scheduledAt).toLocaleString()}</td>
                    <td>{item.recipientCount}</td>
                    <td>
                      <span className={`status-badge ${item.status}`}>{item.status}</span>
                    </td>
                    <td>
                      <button
                        className="cancel-btn"
                        disabled={!canWrite || !canCancel(item.status)}
                        onClick={() => handleCancel(item.id)}
                      >
                        {t('common.cancel')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="list-empty">
              <Send size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
              <p>{t('scheduledMessages.empty')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

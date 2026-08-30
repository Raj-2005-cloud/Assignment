import { useState } from 'react';
import { Send, Plus, Clock, Gauge } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import FileUpload from '../ui/FileUpload';
import { useScheduleEmail } from '../../hooks/useEmails';
import { useSenders, useCreateSender } from '../../hooks/useSenders';
import toast from 'react-hot-toast';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayBetweenMs, setDelayBetweenMs] = useState('2000');
  const [maxPerHour, setMaxPerHour] = useState('50');
  const [emails, setEmails] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // New sender form
  const [showNewSender, setShowNewSender] = useState(false);
  const [newSenderEmail, setNewSenderEmail] = useState('');
  const [newSenderName, setNewSenderName] = useState('');

  const { data: sendersData, isLoading: loadingSenders } = useSenders();
  const scheduleEmail = useScheduleEmail();
  const createSender = useCreateSender();

  const senders = sendersData?.senders || [];

  const handleCreateSender = async () => {
    if (!newSenderEmail || !newSenderName) {
      toast.error('Please fill in sender email and name');
      return;
    }
    try {
      const result = await createSender.mutateAsync({
        email: newSenderEmail,
        displayName: newSenderName,
      });
      setSenderId(result.sender.id);
      setShowNewSender(false);
      setNewSenderEmail('');
      setNewSenderName('');
      toast.success('Sender created with Ethereal credentials');
    } catch {
      toast.error('Failed to create sender');
    }
  };

  const handleSubmit = async () => {
    if (!subject || !body || !senderId || !scheduledAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (emails.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('senderId', senderId);
    formData.append('scheduledAt', new Date(scheduledAt).toISOString());
    formData.append('delayBetweenMs', delayBetweenMs);
    formData.append('maxPerHour', maxPerHour);
    formData.append('recipients', JSON.stringify(emails));

    if (csvFile) {
      formData.append('csvFile', csvFile);
    }

    try {
      const result = await scheduleEmail.mutateAsync(formData);
      toast.success(`${result.totalScheduled} emails scheduled!`);
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to schedule emails');
    }
  };

  const resetForm = () => {
    setSubject('');
    setBody('');
    setSenderId('');
    setScheduledAt('');
    setDelayBetweenMs('2000');
    setMaxPerHour('50');
    setEmails([]);
    setCsvFile(null);
  };

  // Set default scheduled time to 5 min from now
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now.toISOString().slice(0, 16);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose Email" size="lg">
      <div className="space-y-5">
        {/* Sender Selection */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-dark-700">
            Sender Account
          </label>
          {loadingSenders ? (
            <div className="skeleton h-10 w-full rounded-lg" />
          ) : (
            <div className="flex gap-2">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="input-field flex-1"
              >
                <option value="">Select a sender...</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.email})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setShowNewSender(!showNewSender)}
              >
                New
              </Button>
            </div>
          )}

          {/* New Sender Form */}
          {showNewSender && (
            <div className="mt-3 rounded-xl border border-dark-200 bg-dark-50 p-4 space-y-3 animate-slide-down">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Display Name"
                  placeholder="Sales Team"
                  value={newSenderName}
                  onChange={(e) => setNewSenderName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  placeholder="sales@company.com"
                  value={newSenderEmail}
                  onChange={(e) => setNewSenderEmail(e.target.value)}
                />
              </div>
              <p className="text-xs text-dark-400">
                Ethereal SMTP credentials will be auto-generated for this sender.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateSender}
                  isLoading={createSender.isPending}
                >
                  Create Sender
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewSender(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Enter email subject..."
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />

        {/* Body */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-dark-700">
            Body
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email content here..."
            rows={5}
            className="input-field resize-y"
          />
        </div>

        {/* File Upload */}
        <FileUpload
          onEmailsParsed={(parsedEmails) => {
            setEmails(parsedEmails);
          }}
        />

        {/* Schedule Settings */}
        <div className="rounded-xl border border-dark-200 bg-dark-50 p-4 space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-dark-800">
            <Clock className="h-4 w-4 text-brand-600" />
            Schedule Settings
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Start Time"
              type="datetime-local"
              min={getMinDateTime()}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
            <Input
              label="Delay Between Emails"
              type="number"
              min="0"
              value={delayBetweenMs}
              onChange={(e) => setDelayBetweenMs(e.target.value)}
              helperText="Milliseconds"
            />
            <Input
              label="Hourly Limit"
              type="number"
              min="1"
              value={maxPerHour}
              onChange={(e) => setMaxPerHour(e.target.value)}
              helperText="Max emails/hour"
            />
          </div>
        </div>

        {/* Summary */}
        {emails.length > 0 && (
          <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4 animate-slide-up">
            <Gauge className="h-5 w-5 text-brand-600" />
            <div>
              <p className="text-sm font-medium text-brand-800">
                Ready to schedule {emails.length} email{emails.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-brand-600">
                Starting at {scheduledAt ? new Date(scheduledAt).toLocaleString() : '(select time)'} •
                {' '}{delayBetweenMs}ms delay • {maxPerHour}/hr limit
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-dark-100 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            isLoading={scheduleEmail.isPending}
            icon={<Send className="h-4 w-4" />}
            disabled={!subject || !body || !senderId || !scheduledAt || emails.length === 0}
          >
            Schedule Emails
          </Button>
        </div>
      </div>
    </Modal>
  );
}

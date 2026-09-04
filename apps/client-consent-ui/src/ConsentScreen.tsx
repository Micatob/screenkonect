import { useState } from 'react';
import { Shield, Volume2 } from 'lucide-react';

interface ConsentScreenProps {
  sessionId: string;
  onApprove: (permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
  }, shareTarget: 'monitor' | 'window' | 'browser') => void;
  onReject: () => void;
}

export function ConsentScreen({ onApprove, onReject }: ConsentScreenProps) {
  // Default-enabled permissions stay functional but hidden to keep popup short.
  // Only opt-in toggles (audio) are shown.
  const [permissions, setPermissions] = useState({
    view: true,
    control: true,
    clipboard: true,
    file_transfer: true,
    audio: false,
  });
  const [shareTarget, setShareTarget] = useState<'monitor' | 'window' | 'browser'>('monitor');
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const busy = approving || rejecting;

  const handleApprove = async () => {
    if (busy) return;
    setApproving(true);
    try {
      await onApprove({ ...permissions, view: true, control: true, clipboard: true, file_transfer: true }, shareTarget);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (busy) return;
    setRejecting(true);
    try {
      await onReject();
    } finally {
      setRejecting(false);
    }
  };

  const togglePermission = (key: keyof typeof permissions) => {
    if (key !== 'audio') return;
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-blue-600 p-6 text-center">
            <Shield className="w-12 h-12 text-white mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Remote Support Request</h1>
            <p className="text-blue-100 mt-2">A technician is requesting access to your device</p>
          </div>

          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-700">
                Shares screen, control, clipboard & files automatically
                {permissions.audio ? ' + audio' : ''}.
              </p>
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Optional:</h3>
            <div className="space-y-3 mb-6">
              <PermissionToggle
                icon={<Volume2 className="w-5 h-5" />}
                label="Audio sharing"
                description="Share system audio"
                checked={permissions.audio}
                onChange={() => togglePermission('audio')}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <h4 className="font-medium text-blue-900 text-sm mb-2">What to share (avoids mirror loop):</h4>
              <div className="grid grid-cols-3 gap-2">
                {(['monitor','window','browser'] as const).map((t) => (
                  <button key={t} onClick={() => setShareTarget(t)} className={`p-2 rounded border text-xs ${shareTarget===t?'bg-blue-600 text-white border-blue-600':'bg-white border-gray-200'}`}>
                    {t==='monitor'?'Entire Screen':t==='window'?'Window':'Browser Tab'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                {shareTarget==='monitor'?'Shares whole desktop — minimizing browser will show desktop. Best for full help. If testing on same PC, use Window to avoid mirror.':'Shares only selected window/tab — minimizing will show black. Use Entire Screen for desktop.'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>Important:</strong> You can end this session at any time by closing this
                window or clicking the "End Session" button. The technician will lose access
                immediately.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReject}
                disabled={busy}
                className="flex-1 py-3 px-4 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
              >
                {rejecting ? 'Denying...' : 'Deny'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={busy}
                className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {approving ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PermissionToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}

function PermissionToggle({
  icon,
  label,
  description,
  checked,
  disabled,
  onChange,
}: PermissionToggleProps) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        checked
          ? 'bg-blue-50 border-blue-200'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div className={`${checked ? 'text-blue-600' : 'text-gray-400'}`}>{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-sm text-gray-500">{description}</div>
      </div>
      <div
        className={`w-10 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
    </label>
  );
}

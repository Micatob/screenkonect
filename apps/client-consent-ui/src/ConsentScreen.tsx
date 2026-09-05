import { useState } from 'react';
import { Video, Camera, Mic, Volume2, Clock, Monitor } from 'lucide-react';

interface ConsentScreenProps {
  sessionId: string;
  durationMinutes?: number;
  onApprove: (permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
    camera: boolean;
    mic: boolean;
  }, shareTarget: 'monitor' | 'window' | 'browser') => void;
  // Kept for API compat; the Deny button was removed so one click starts help.
  // Closing this window at any time still refuses/ends the session.
  onReject?: () => void;
}

export function ConsentScreen({ durationMinutes = 60, onApprove }: ConsentScreenProps) {
  // Screen/control/clipboard/files are always on (shown as meeting defaults below).
  // Camera, mic and audio are opt-in toggles.
  const [permissions, setPermissions] = useState({
    view: true,
    control: true,
    clipboard: true,
    file_transfer: true,
    audio: false,
    camera: false,
    mic: false,
  });
  const [shareTarget, setShareTarget] = useState<'monitor' | 'window' | 'browser'>('monitor');
  const [approving, setApproving] = useState(false);

  const handleApprove = async () => {
    if (approving) return;
    setApproving(true);
    try {
      await onApprove({ ...permissions, view: true, control: true, clipboard: true, file_transfer: true }, shareTarget);
    } finally {
      setApproving(false);
    }
  };

  const togglePermission = (key: 'audio' | 'camera' | 'mic') => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const extrasOn = [
    permissions.camera && 'camera',
    permissions.mic && 'mic',
    permissions.audio && 'audio',
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-blue-600 p-6 text-center">
            <Video className="w-12 h-12 text-white mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Meeting request</h1>
            <p className="text-blue-100 mt-2">You have been invited to this meeting</p>
          </div>

          <div className="p-6">
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
              <Clock className="w-5 h-5 text-gray-500 shrink-0" />
              <p className="text-sm text-gray-700">
                Duration <strong>{durationMinutes} minutes</strong>
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-700 flex items-start gap-2">
                <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Screen, control, clipboard &amp; files are shared automatically
                  {extrasOn ? `, plus ${extrasOn}` : ''}.
                </span>
              </p>
            </div>

            <h3 className="font-semibold text-gray-900 mb-3">Turn on for this meeting:</h3>
            <div className="space-y-3 mb-6">
              <PermissionToggle
                icon={<Camera className="w-5 h-5" />}
                label="Camera"
                description="Share your camera video"
                checked={permissions.camera}
                onChange={() => togglePermission('camera')}
              />
              <PermissionToggle
                icon={<Mic className="w-5 h-5" />}
                label="Microphone"
                description="Let the technician hear you"
                checked={permissions.mic}
                onChange={() => togglePermission('mic')}
              />
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

            <div className="bg-gray-900 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-white text-sm mb-1">Need full desktop help?</h4>
              <p className="text-xs text-gray-400 mb-3">
                This page can only share this browser tab. For the technician to see and control
                your whole desktop, run the one-click agent:
              </p>
              <ol className="text-xs text-gray-300 list-decimal list-inside space-y-1 mb-3">
                <li>Download <span className="font-mono">screenkonect-agent.exe</span> below</li>
                <li>Double-click it, paste your join link when asked</li>
                <li>Keep this page open until the technician connects</li>
              </ol>
              <a
                href="/downloads/screenkonect-agent.exe"
                download="screenkonect-agent.exe"
                className="block text-center py-2 px-4 bg-white text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Download Windows agent
              </a>
              <p className="text-xs text-gray-500 mt-2">
                After downloading, double-click the file (Windows may ask "Unknown publisher" - click More info / Run anyway), paste your join link, and keep this page open.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {approving ? 'Starting...' : 'Allow access'}
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              Changed your mind? Just close this window - nothing is shared until you click above.
            </p>
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

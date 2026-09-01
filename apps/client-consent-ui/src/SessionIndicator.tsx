import { useState } from 'react';
import { Monitor, Shield, Eye, MousePointer, Clipboard, FileUp, Volume2 } from 'lucide-react';

interface SessionIndicatorProps {
  sessionId: string;
  permissions: {
    view: boolean;
    control: boolean;
    clipboard: boolean;
    file_transfer: boolean;
    audio: boolean;
  };
  onEndSession: () => void;
}

export function SessionIndicator({ permissions, onEndSession }: SessionIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleEnd = async () => {
    if (!confirm('End this support session? The technician will lose access immediately.')) {
      return;
    }
    setEnding(true);
    await onEndSession();
  };

  return (
    <div className="fixed inset-0 pointer-events-none">
      <div className="fixed top-4 right-4 pointer-events-auto">
        <div className="bg-red-600 text-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 px-4 py-3 w-full hover:bg-red-700 transition-colors"
          >
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <Monitor className="w-5 h-5" />
            <span className="font-medium">Screen Shared</span>
            <span className="text-red-200">•</span>
            <span className="text-sm text-red-200">Active</span>
          </button>

          {showDetails && (
            <div className="border-t border-red-500 bg-red-700 p-4">
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Active Permissions:</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Screen viewing</span>
                  </div>
                  {permissions.control && (
                    <div className="flex items-center gap-2">
                      <MousePointer className="w-4 h-4" />
                      <span>Remote control</span>
                    </div>
                  )}
                  {permissions.clipboard && (
                    <div className="flex items-center gap-2">
                      <Clipboard className="w-4 h-4" />
                      <span>Clipboard sync</span>
                    </div>
                  )}
                  {permissions.file_transfer && (
                    <div className="flex items-center gap-2">
                      <FileUp className="w-4 h-4" />
                      <span>File transfer</span>
                    </div>
                  )}
                  {permissions.audio && (
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4" />
                      <span>Audio sharing</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-red-800 rounded p-3 mb-3">
                <p className="text-sm text-red-200">
                  Your screen is being shared with a support technician. You can end this session
                  at any time.
                </p>
              </div>

              <button
                onClick={handleEnd}
                disabled={ending}
                className="w-full py-2 bg-white text-red-600 font-medium rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                {ending ? 'Ending...' : 'End Session'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-4 left-4 pointer-events-auto">
        <div className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-3">
          <Shield className="w-5 h-5 text-green-600" />
          <div className="text-sm">
            <div className="font-medium text-gray-900">Protected Session</div>
            <div className="text-gray-500">You can end this session at any time</div>
          </div>
        </div>
      </div>
    </div>
  );
}

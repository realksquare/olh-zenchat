import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useZenVoiceStore } from "../../stores/zenVoiceStore";
import ZenVoiceVerifyModal from "./ZenVoiceVerifyModal";
import ZenVoiceRoomBrowser from "./ZenVoiceRoomBrowser";
import ZenVoiceRoom from "./ZenVoiceRoom";

const ZenVoicePortal = ({ isOpen, onClose, inviteToken }) => {
    const { isVerified, checkStatus } = useZenVoiceStore();
    const [activeRoomId, setActiveRoomId] = useState(null);
    const [showVerifier, setShowVerifier] = useState(false);
    const [pendingInviteToken, setPendingInviteToken] = useState(null);

    useEffect(() => {
        if (isOpen) {
            checkStatus().then((res) => {
                if (res?.success && (res?.isVerified || res?.isRegistered)) {
                    setShowVerifier(false);
                } else {
                    setShowVerifier(true);
                }
            });
        } else {
            setActiveRoomId(null);
            setPendingInviteToken(null);
        }
    }, [isOpen, checkStatus]);

    // Store the invite token when it arrives so it survives verification flow
    useEffect(() => {
        if (inviteToken) setPendingInviteToken(inviteToken);
    }, [inviteToken]);

    if (!isOpen) return null;

    if (showVerifier) {
        return (
            <ZenVoiceVerifyModal
                isOpen={isOpen}
                onClose={onClose}
                onVerificationSuccess={() => setShowVerifier(false)}
            />
        );
    }

    const handleRoomSelect = (roomId) => {
        setActiveRoomId(roomId);
    };

    const handleBackToBrowser = () => {
        setActiveRoomId(null);
    };

    return createPortal(
        <div className="admin-modal-overlay" style={{ zIndex: 99999 }} onClick={onClose}>
            <div 
                className="admin-modal-content" 
                onClick={(e) => e.stopPropagation()} 
                style={{ 
                    width: "100%", 
                    maxWidth: "520px", 
                    height: "90vh", 
                    maxHeight: "750px",
                    borderRadius: "16px", 
                    background: "var(--color-surface, #0f172a)", 
                    border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))", 
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden"
                }}
            >
                {activeRoomId ? (
                    <ZenVoiceRoom roomId={activeRoomId} onBack={handleBackToBrowser} />
                ) : (
                    <ZenVoiceRoomBrowser
                        onBack={onClose}
                        onRoomSelect={handleRoomSelect}
                        inviteToken={pendingInviteToken}
                        onInviteConsumed={() => setPendingInviteToken(null)}
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default ZenVoicePortal;

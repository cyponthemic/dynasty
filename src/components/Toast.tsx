import { useEffect, useState } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';

type ToastProps = {
  message: string;
  type: 'error' | 'success' | 'info';
  onClose: () => void;
  duration?: number;
};

const GIF_KEY = "FNSlyUEDW7npOTxjrmgtCMxYC7JcpMnv";
const gf = new GiphyFetch(GIF_KEY);

export function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  const [violinGif, setViolinGif] = useState<string | null>(null);
  const [isLoadingGif, setIsLoadingGif] = useState(false);

  useEffect(() => {
    if (type === 'error') {
      setIsLoadingGif(true);
      gf.random({ tag: 'tiny violin', rating: 'g' })
        .then(({ data }) => {
          if (data.images?.downsized?.url) {
            setViolinGif(data.images.downsized.url);
          }
        })
        .catch((err) => {
          console.error('Failed to load Giphy GIF:', err);
          // Fallback to a default GIF or emoji
          setViolinGif(null);
        })
        .finally(() => {
          setIsLoadingGif(false);
        });
    }
  }, [type]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = {
    error: '#ffffff',
    success: '#4caf50',
    info: '#2196f3',
  }[type];

  const textColor = {
    error: '#333',
    success: 'white',
    info: 'white',
  }[type];

  const borderColor = {
    error: '#f44336',
    success: 'transparent',
    info: 'transparent',
  }[type];

  const icon = {
    error: null, // We'll use GIF instead
    success: '✓',
    info: 'ℹ️',
  }[type];

  const isErrorLayout = type === 'error';

  return (
    <div
      style={{
        backgroundColor: bgColor,
        color: textColor,
        padding: isErrorLayout ? '0' : '1rem 1.5rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        minWidth: '300px',
        maxWidth: '500px',
        display: 'flex',
        alignItems: isErrorLayout ? 'stretch' : 'flex-start',
        gap: isErrorLayout ? '0' : '0.75rem',
        border: borderColor !== 'transparent' ? `2px solid ${borderColor}` : 'none',
        overflow: 'hidden',
      }}
    >
      {isErrorLayout ? (
        <>
          <div
            style={{
              width: '30%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#333',
              padding: '0.5rem',
              minHeight: '80px',
            }}
          >
            {isLoadingGif ? (
              <div style={{ fontSize: '2rem' }}>🎻</div>
            ) : violinGif ? (
              <img
                src={violinGif}
                alt="tiny violin"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  maxHeight: '100px',
                }}
              />
            ) : (
              <div style={{ fontSize: '2rem' }}>🎻</div>
            )}
          </div>
          <div
            style={{
              width: '70%',
              padding: '1rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'transparent',
                border: 'none',
                color: textColor,
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0',
                lineHeight: '1',
                opacity: 0.8,
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = '0.8';
              }}
            >
              ×
            </button>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', textAlign: 'left' }}>
              Error
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4', textAlign: 'left' }}>{message}</div>
          </div>
        </>
      ) : (
        <>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {type === 'success' ? 'Success' : 'Info'}
            </div>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{message}</div>
          </div>
        </>
      )}
      {!isErrorLayout && (
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: textColor,
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0',
            lineHeight: '1',
            opacity: 0.8,
            flexShrink: 0,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

type ToastContainerProps = {
  toasts: Array<{ id: string; message: string; type: 'error' | 'success' | 'info' }>;
  onClose: (id: string) => void;
};

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => onClose(toast.id)}
            />
          </div>
        ))}
      </div>
    </>
  );
}


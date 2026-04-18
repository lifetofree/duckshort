import React from 'react';
import { useTranslation } from '../lib/i18n';
import './Modal.css';

const Modal = ({ isOpen, shortUrl, onClose, onCopy, copySuccess }) => {
  const { t: translate } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="modal-header">
          <h2 className="modal-title">{translate('modal.title')}</h2>
        </div>

        <div className="modal-body">
          <div>
            <p className="modal-label">{translate('modal.label')}</p>
            <div className="short-url-container">
              <input
                type="text"
                className="short-url-input"
                value={shortUrl || ''}
                readOnly
              />
            </div>
          </div>

          <button 
            className={`copy-button ${copySuccess ? 'copied' : ''}`}
            onClick={onCopy}
          >
            <span className="material-symbols-outlined">
              {copySuccess ? 'check' : 'content_copy'}
            </span>
            <span>{copySuccess ? translate('modal.copied') : translate('modal.copyToClipboard')}</span>
          </button>
        </div>

        <div className="modal-status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="status-dot"></span>
            <span>{translate('modal.status.transferComplete')}</span>
          </div>
          <span>{translate('modal.status.channelSecured')}</span>
        </div>
      </div>
    </div>
  );
};

export default Modal;
'use client';

import { motion } from 'framer-motion';
import { CloseIcon, SettingsIcon } from './Icons';

export default function HoldingActionModal({ fund, onClose, onAction, hasHistory }) {
  return (
    <motion.div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="持仓操作"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass card modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '320px' }}
      >
        <div className="title" style={{ marginBottom: 20, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SettingsIcon width="20" height="20" />
            <span>持仓操作</span>
              <button
                type="button"
                onClick={() => onAction('history')}
                style={{ 
                  marginLeft: 8, 
                  padding: '4px 8px', 
                  fontSize: '12px', 
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="查看交易记录"
              >
                <span>📜</span>
                <span>交易记录</span>
              </button>
          </div>
          <button className="icon-button" onClick={onClose} style={{ border: 'none', background: 'transparent' }}>
            <CloseIcon width="20" height="20" />
          </button>
        </div>

        <div style={{ marginBottom: 20, textAlign: 'center' }}>
          <div className="fund-name" style={{ fontWeight: 600, fontSize: '16px', marginBottom: 4 }}>{fund?.name}</div>
          <div className="muted" style={{ fontSize: '12px' }}>#{fund?.code}</div>
        </div>

        <div className="grid" style={{ gap: 12 }}>
          <button
            className="button col-4"
            onClick={() => onAction('buy')}
            style={{ background: 'var(--selected-bg)', border: '1px solid var(--primary)', color: 'var(--primary)', fontSize: 14 }}
          >
            加仓
          </button>
          <button
            className="button col-4"
            onClick={() => onAction('sell')}
            style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 14 }}
          >
            减仓
          </button>
          <button
            className="button col-4 dca-btn"
            onClick={() => onAction('dca')}
            style={{ fontSize: 14 }}
          >
            定投
          </button>
          <button className="button col-12" onClick={() => onAction('edit')} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}>
            编辑持仓
          </button>
          <button
            className="button col-12"
            onClick={() => onAction('clear')}
            style={{
              marginTop: 8,
              background: 'var(--danger)',
              border: '1px solid var(--danger)',
              color: '#fff',
              fontWeight: 600
            }}
          >
            清空持仓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

"use client";
import { useEffect, useRef } from 'react';
import { Info, X } from '@phosphor-icons/react';

import { CONFIDENCE_LABEL, CONFIDENCE_ORDER } from '@/lib/roi';
import type { ConfidenceFactor, ConfidenceLevel, ConfidenceReading } from '@/lib/roi';

/* Figma "roi/confidence · pills (option)" 6768:53357, option D: five pills
   and the level, no sales count. The whole chip opens the details. */
export function ConfidenceChip({ level, onOpen }: { level: ConfidenceLevel; onOpen?: () => void }) {
  if (level === 'none') return null;
  if (level === 'yours') return <span className="v2-conf yours">{CONFIDENCE_LABEL.yours}</span>;
  const lit = CONFIDENCE_ORDER.length - CONFIDENCE_ORDER.indexOf(level);
  return (
    <button type="button" className="v2-conf" onClick={onOpen} aria-haspopup="dialog">
      <span className="pills" aria-hidden="true">
        {CONFIDENCE_ORDER.map((_, i) => <i key={i} className={i < lit ? 'on' : undefined} />)}
      </span>
      {CONFIDENCE_LABEL[level]}
      <Info size={16} aria-hidden="true" />
    </button>
  );
}

/** What each factor's line says, from the reading. */
function lineOf(f: ConfidenceFactor, r: ConfidenceReading): { name: string; text: string } {
  switch (f.key) {
    case 'count':
      return { name: 'Comparable sales', text: `${r.count} sale${r.count === 1 ? '' : 's'}${f.strong ? '' : ', fewer than usual'}` };
    case 'distance':
      return {
        name: 'Distance',
        text: r.maxMi <= 0.5 ? 'All within 0.5 mi' : r.maxMi <= 1 ? 'All within 1 mi' : r.maxMi <= 2 ? 'All within 2 mi' : 'Some farther than 2 mi',
      };
    case 'size':
      return {
        name: 'Size',
        text: r.sizeSpread <= 0.15 ? 'Within ±15% of the planned build'
          : r.sizeSpread <= 0.25 ? 'Within ±25% of the planned build'
          : r.sizeSpread <= 0.35 ? 'Within ±35% of the planned build'
          : 'Some differ from the planned build by more than 35%',
      };
    default:
      return { name: 'Sale date', text: r.oldestMonths <= 6 ? 'All in the last 6 months' : 'All in the last 12 months' };
  }
}

interface DetailsProps {
  reading: ConfidenceReading;
  open: boolean;
  onClose: () => void;
  /** "Set your own sale price →": the assumptions, on the sale price. */
  onOwnPrice: () => void;
}

/**
 * Figma "confidence details" 6714:48385: the modal the chip opens on
 * desktop. A native <dialog>, so focus, Escape and the backdrop come with it.
 */
export function ConfidenceDetails({ reading, open, onClose, onOwnPrice }: DetailsProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (reading.level === 'none') return null;

  return (
    <dialog
      ref={ref}
      className="v2-confd"
      aria-labelledby="v2-confd-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="in">
        <div className="top">
          <h2 id="v2-confd-title">{CONFIDENCE_LABEL[reading.level]}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="lede">How well nearby sales back this estimate. Four things set the level.</p>
        <ul>
          {reading.factors.map((f) => {
            const { name, text } = lineOf(f, reading);
            return (
              <li key={f.key}>
                <span><b>{name}</b><small>{text}</small></span>
                <em className={f.strong ? 'strong' : undefined}>{f.strong ? 'Strong' : 'Lowers the level'}</em>
              </li>
            );
          })}
        </ul>
        <p className="foot">Sales older than 12 months are not used.</p>
        <div className="actions">
          <button type="button" className="ok" onClick={onClose}>Got it</button>
          <button type="button" className="own" onClick={() => { onClose(); onOwnPrice(); }}>Set your own sale price →</button>
        </div>
      </div>
    </dialog>
  );
}

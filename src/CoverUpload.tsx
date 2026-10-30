import {useEffect, useId, useRef, useState} from 'react';
import {CheckCircle2, ImagePlus, LoaderCircle, RotateCcw} from 'lucide-react';
import {en, he} from './i18n';
import {CoverImageError, prepareCoverImage} from './cover-image';

const DEFAULT_COVER = '/assets/holiday-scene.webp';

export default function CoverUpload({value, onChange, onBusyChange, hebrew = false}: {
 value: string; onChange: (image: string) => void; onBusyChange: (busy: boolean) => void; hebrew?: boolean;
}) {
 const t = hebrew ? he : en;
 const id = useId();
 const input = useRef<HTMLInputElement>(null);
 const operation = useRef(0);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [filename, setFilename] = useState('');
 useEffect(() => () => { operation.current++; onBusyChange(false); }, [onBusyChange]);

 async function upload(file?: File) {
  if (!file) return;
  const current = ++operation.current;
  setBusy(true); onBusyChange(true); setError('');
  try {
   const image = await prepareCoverImage(file);
   if (current !== operation.current) return;
   onChange(image); setFilename(file.name);
  } catch (cause) {
   if (current !== operation.current) return;
   setError(cause instanceof CoverImageError && cause.reason === 'size' ? t.imageLimit :
    cause instanceof CoverImageError && cause.reason === 'type' ? t.imageType : t.imageFailed);
  } finally {
   if (current === operation.current) { setBusy(false); onBusyChange(false); }
  }
 }

 return <div className="cover-upload" aria-busy={busy}>
  <div className="cover-upload-main">
   <img src={value || DEFAULT_COVER} alt={t.coverPreview} />
   <div><strong>{t.image}</strong><p id={`${id}-help`}>{t.imageHelp}</p>
    <button type="button" className="button secondary upload-button" disabled={busy} onClick={() => input.current?.click()}>
     {busy ? <LoaderCircle size={16} className="loading" /> : <ImagePlus size={16} />}{busy ? t.imagePreparing : t.upload}
    </button>
   </div>
  </div>
  <input ref={input} id={id} className="accessible-file" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
   aria-label={t.upload} aria-describedby={`${id}-help`} disabled={busy}
   onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void upload(file); }} />
  {error && <p className="upload-error" role="alert">{error}</p>}
  {!error && filename && <p className="upload-success" role="status"><CheckCircle2 size={14} />{t.coverUploaded}: <span>{filename}</span></p>}
  {value !== DEFAULT_COVER && <button type="button" className="text-button cover-reset" disabled={busy} onClick={() => { onChange(DEFAULT_COVER); setFilename(''); setError(''); }}><RotateCcw size={13} />{t.defaultImage}</button>}
 </div>;
}

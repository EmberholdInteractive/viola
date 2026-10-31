# Viola: Sprecher-Erkennung (WhisperX + pyannote). Aufruf: python diarize.py <audio> <hf_token> [sprache] [min] [max]
# Ausgabe: JSON-Liste [{start, end, text, speaker}] auf stdout. Braucht: pip install whisperx und einen Hugging-Face-Token (pyannote-Nutzungsbedingungen akzeptiert).
import sys, json
audio, token = sys.argv[1], sys.argv[2]
lang = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != 'auto' else None
mn = int(sys.argv[4]) if len(sys.argv) > 4 else None
mx = int(sys.argv[5]) if len(sys.argv) > 5 else None
import torch, whisperx
dev = 'cuda' if torch.cuda.is_available() else 'cpu'
model = whisperx.load_model('large-v3' if dev == 'cuda' else 'small', dev, compute_type='float16' if dev == 'cuda' else 'int8', language=lang)
a = whisperx.load_audio(audio)
r = model.transcribe(a, batch_size=8 if dev == 'cuda' else 2)
am, meta = whisperx.load_align_model(language_code=r['language'], device=dev)
r = whisperx.align(r['segments'], am, meta, a, dev)
d = whisperx.DiarizationPipeline(use_auth_token=token, device=dev)(a, min_speakers=mn, max_speakers=mx)
r = whisperx.assign_word_speakers(d, r)
print(json.dumps([{'start': s['start'], 'end': s['end'], 'text': s['text'].strip(), 'speaker': s.get('speaker', '?')} for s in r['segments']], ensure_ascii=False))

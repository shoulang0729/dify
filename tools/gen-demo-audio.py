#!/usr/bin/env python3
"""
tools/gen-demo-audio.py — KN-11 用のダミー音声（合成音声）を生成する

設計書: docs/handoff/2026-09-16-showcase-demo.md §9-4（PR-0）。
PM 決定（2026-09-16、Issue #311 スレッド）：この環境で動くオフライン TTS を使って
実際に合成音声を生成する（外部の読み上げサービスへは 1 バイトも送信しない。すべて
ローカルの推論）。
  - 日本語: pyopenjtalk（オープンソースの日本語 TTS。初回だけ辞書を取得）
  - 中国語: sherpa-onnx の VITS モデル sherpa-onnx-vits-zh-ll（118MB。
    リポジトリには入れず、初回だけこのスクリプトが取得してキャッシュする）

読み上げるテキストは KN-11 の勘所・判断基準（本設計書 §7-2 の result と同じ内容）を
自然な話し言葉に書き起こしたもの。実際の聞き取りは「32 分 14 秒」という設定だが、
ここで作るのは冒頭の要点を抜粋した音声（1 分前後）。

## セットアップ（初回のみ）

```
python3 -m venv .venv-tts
source .venv-tts/bin/activate
SSL_CERT_FILE=/root/.ccr/ca-bundle.crt PIP_CERT=/root/.ccr/ca-bundle.crt \\
  pip install "numpy<2" pyopenjtalk-prebuilt sherpa-onnx
```

## 使い方

```
source .venv-tts/bin/activate
python3 tools/gen-demo-audio.py
# 中国語モデルを既に展開済みなら --zh-model で指定できる（再取得しない）:
python3 tools/gen-demo-audio.py --zh-model /path/to/sherpa-onnx-vits-zh-ll
```

npm test / npm run ci からは呼ばない（Python の TTS 依存はルート package.json・
requirements のどこにも足さない。tools/verify.mjs §20 は生成物 mock/assets/demo/
kn11-interview-*.wav / *.txt の存在・拡張子・サイズだけを検査する）。
"""
import argparse
import os
import subprocess
import sys

import numpy as np
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_DIR = os.path.join(ROOT, 'mock', 'assets', 'demo')
CACHE_DIR = os.path.join(HERE, '.cache')
ZH_MODEL_URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/sherpa-onnx-vits-zh-ll.tar.bz2'

NOTE_JA = (
    "【デモ用の合成音声（文字起こし）】\n"
    "この音声はオフラインの音声合成（pyopenjtalk）で作った合成音です。実在の人の声は使っていません。\n"
    "実際の聞き取りは32分14秒という設定ですが、この音声は冒頭の要点だけを抜粋したもの（約 {dur:.0f} 秒）です。\n"
    "外部の読み上げサービスへは送信していません（ローカルで生成しています）。\n\n"
)

NOTE_ZH = (
    "【演示用合成语音（文字转写）】\n"
    "本音频由离线语音合成（sherpa-onnx VITS）生成，未使用真人声音。\n"
    "实际访谈设定为32分14秒，本音频仅截取开头要点部分（约 {dur:.0f} 秒）。\n"
    "未发送至任何外部朗读服务（本地生成）。\n\n"
)

# KN-11 の勘所・判断基準（本設計書 §7-2 の result.ja/zh.items と同じ内容の話し言葉版）
TEXT_JA = (
    "冬場、1月から2月にかけては、予熱を40度まで上げても初品がずれることがあります。"
    "そういうときは、空打ちを3回してから初品を取るようにしています。"
    "ボルスタに残った切りくずは、目で見るだけでは分かりません。指で触って確認しています。"
    "ガイドの当たりは音で分かります。コツと鳴ったら、当たり面を確認します。"
    "芯出しは、前後を先に決めます。左右を先にやると、2回やり直すことになります。"
    "予熱の温度は、今の標準では40度以上と決まっていますが、冬場は40度でも足りないと感じています。"
    "空打ちの回数は、今の標準には決まりがありません。私は3回にしています。"
    "初品が合格かどうかは、寸法検査記録の判定に従っています。"
)

TEXT_ZH = (
    "冬季，也就是一月到二月，即使把预热提高到四十度，首件有时候还是会出现偏差。"
    "这种时候，我会先空打三次，然后再取首件。"
    "工作台上剩下的切屑，光用眼睛看是看不出来的，要用手指摸一下确认。"
    "导向的接触，靠声音就能听出来，听到咔的一声，就要检查接触面。"
    "对中的时候，要先确定前后方向，如果先做左右方向，就要返工两次。"
    "预热温度，现在的标准规定是四十度以上，但是冬季即使到了四十度，我还是觉得不够。"
    "空打的次数，现在的标准里没有规定，我自己一直用三次。"
    "首件是否合格，按照尺寸检查记录的判定来。"
)


def write_wav_int16(path, samples_int16, sample_rate):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(samples_int16.tobytes())


def resample_48k_to_16k(x):
    """48kHz -> 16kHz。scipy の無い環境のため簡易な低域通過（5 タップ）＋間引き 1/3。
    デモ用の合成音声であり、音質の厳密さは求めない。"""
    kernel = np.array([1.0, 2.0, 3.0, 2.0, 1.0])
    kernel = kernel / kernel.sum()
    xf = np.convolve(x, kernel, mode='same')
    n = len(xf) - (len(xf) % 3)
    return xf[:n:3]


def to_int16(x):
    peak = float(np.max(np.abs(x))) or 1.0
    scaled = x / peak * 0.9  # ピークで正規化し 0.9 フルスケールに収める
    return (scaled * 32767.0).astype(np.int16)


def gen_ja(out_wav, out_txt):
    import pyopenjtalk
    x, sr = pyopenjtalk.tts(TEXT_JA)
    assert sr == 48000, f'想定外のサンプルレート: {sr}'
    x16k = resample_48k_to_16k(np.asarray(x, dtype=np.float64))
    samples = to_int16(x16k)
    write_wav_int16(out_wav, samples, 16000)
    dur = len(samples) / 16000
    with open(out_txt, 'w', encoding='utf-8') as f:
        f.write(NOTE_JA.format(dur=dur))
        f.write(TEXT_JA)
        f.write('\n')
    print(f'生成: {out_wav} ({dur:.1f} 秒, {os.path.getsize(out_wav)} bytes)')


def ensure_zh_model(explicit_dir):
    if explicit_dir:
        if not os.path.isfile(os.path.join(explicit_dir, 'model.onnx')):
            print(f'ERROR: {explicit_dir} に model.onnx が無い', file=sys.stderr)
            sys.exit(1)
        return explicit_dir

    model_dir = os.path.join(CACHE_DIR, 'sherpa-onnx-vits-zh-ll')
    if os.path.isfile(os.path.join(model_dir, 'model.onnx')):
        return model_dir

    os.makedirs(CACHE_DIR, exist_ok=True)
    tarball = os.path.join(CACHE_DIR, 'sherpa-onnx-vits-zh-ll.tar.bz2')
    print(f'中国語 TTS モデルを取得します（約 118MB、初回のみ）: {ZH_MODEL_URL}')
    subprocess.run(['curl', '-L', '--fail', '-o', tarball, ZH_MODEL_URL], check=True)
    subprocess.run(['tar', 'xjf', tarball, '-C', CACHE_DIR], check=True)
    os.remove(tarball)
    if not os.path.isfile(os.path.join(model_dir, 'model.onnx')):
        print('ERROR: 展開後も model.onnx が見つからない', file=sys.stderr)
        sys.exit(1)
    return model_dir


def gen_zh(out_wav, out_txt, model_dir, sid=2):
    import sherpa_onnx
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=os.path.join(model_dir, 'model.onnx'),
                lexicon=os.path.join(model_dir, 'lexicon.txt'),
                tokens=os.path.join(model_dir, 'tokens.txt'),
                dict_dir=os.path.join(model_dir, 'dict'),
            ),
            num_threads=1,
        ),
        rule_fsts=','.join(os.path.join(model_dir, f) for f in
                            ('phone.fst', 'date.fst', 'number.fst', 'new_heteronym.fst')),
        max_num_sentences=1,
    )
    tts = sherpa_onnx.OfflineTts(cfg)
    audio = tts.generate(TEXT_ZH, sid=sid, speed=1.0)
    samples = to_int16(np.asarray(audio.samples, dtype=np.float64))
    write_wav_int16(out_wav, samples, audio.sample_rate)
    dur = len(samples) / audio.sample_rate
    with open(out_txt, 'w', encoding='utf-8') as f:
        f.write(NOTE_ZH.format(dur=dur))
        f.write(TEXT_ZH)
        f.write('\n')
    print(f'生成: {out_wav} ({dur:.1f} 秒, {os.path.getsize(out_wav)} bytes, sid={sid})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zh-model', default=None,
                     help='sherpa-onnx-vits-zh-ll モデルディレクトリ。省略時は '
                          'tools/.cache/ に取得済みならそれを使い、無ければ取得する')
    ap.add_argument('--sid', type=int, default=2, help='中国語モデルの話者 id（既定 2）')
    ap.add_argument('--skip-zh', action='store_true', help='中国語音声を生成しない（動作確認用）')
    args = ap.parse_args()

    os.makedirs(OUT_DIR, exist_ok=True)

    gen_ja(os.path.join(OUT_DIR, 'kn11-interview-ja.wav'),
           os.path.join(OUT_DIR, 'kn11-interview-ja.txt'))

    if args.skip_zh:
        return
    model_dir = ensure_zh_model(args.zh_model)
    gen_zh(os.path.join(OUT_DIR, 'kn11-interview-zh.wav'),
           os.path.join(OUT_DIR, 'kn11-interview-zh.txt'),
           model_dir, sid=args.sid)


if __name__ == '__main__':
    main()

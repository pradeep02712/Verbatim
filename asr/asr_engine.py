import whisperx
import torch
import gc
import sys
import os

def main(audio_file):
    # Low Mem Config
    # device = "cpu"
    # model = "base"
    # batch_size = 4
    compute_type = "int8"

    # High Mem Config
    device = "cuda"
    model = "large-v2"
    batch_size = 16
    # compute_type = "float16"

    # Model Save
    model_dir = "../assets/model/"

    # Batched Transcription
    model_t = whisperx.load_model(model, device, compute_type = compute_type, download_root = model_dir)

    audio = whisperx.load_audio(audio_file)
    result = model_t.transcribe(audio, batch_size = batch_size)
    print(result["segments"])

    # Delete Transcription Model
    gc.collect();
    torch.cuda.empty_cache();
    del model

    # Phoneme Alignment
    model_a, metadata = whisperx.load_align_model(language_code = result["language"], device = device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments = False)
    print(result["segments"])

    # Delete Alignment Model
    gc.collect();
    torch.cuda.empty_cache();
    del model_a

    # Label Speakers and Diarize
    token = os.getenv("HF_TOKEN")
    if not token:
        raise RuntimeError("HF_TOKEN environment variable is not set")
    diarize_model = whisperx.DiarizationPipeline(use_auth_token = token, device=device)

    # Speaker Count Bounds
    diarize_segments = diarize_model(audio, min_speakers = 1, max_speakers = 16)

    result = whisperx.assign_word_speakers(diarize_segments, result)
    print(diarize_segments)

    print(result["segments"])

if __name__ == "__main__":
    audio_path = sys.argv[1]
    main(audio_path)

# Audio-to-Audio Emotion Conversion With Pitch And Duration Style Transfer

## arXiv ID
2505.17655

## Authors
Soumya Dutta, Avni Jain, Sriram Ganapathy

## Abstract
Given a pair of source and reference speech recordings, audio-to-audio (A2A) style transfer involves the generation of an output speech that mimics the style characteristics of the reference while preserving the content and speaker attributes of the source. This paper proposes a novel framework, termed as A2A Zero-shot Emotion Style Transfer (A2A-ZEST), that enables the transfer of reference emotional attributes to the source while retaining its speaker and speech contents. The A2A-ZEST framework consists of an analysis-synthesis pipeline, where the analysis module decomposes speech into semantic tokens, speaker representations, and emotion embeddings. Using these representations, a pitch contour estimator and a duration predictor are learned. Further, a synthesis module is designed to generate speech based on the input representations and the derived factors. This entire paradigm of analysis-synthesis is trained purely in a self-supervised manner with an auto-encoding loss.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.17655)
- [Download PDF](https://arxiv.org/pdf/2505.17655.pdf)

## Extracted Text
arXiv:2505.17655v1  [eess.AS]  23 May 2025JOURNAL OF L ATEX CLASS FILES, VOL. 14, NO. 8, MAY 2025 1
Audio-to-Audio Emotion Conversion With Pitch
And Duration Style Transfer
Soumya Dutta, Student Member, IEEE, Avni Jain and Sriram Ganapathy, Senior Member, IEEE
Abstract —Given a pair of source and reference speech record-
ings, audio-to-audio (A2A) style transfer involves the generation
of an output speech that mimics the style characteristics of the
reference while preserving the content and speaker attributes
of the source. In this paper, we propose a novel framework,
termed as A2A Zero-shot Emotion Style Transfer (A2A-ZEST),
that enables the transfer of reference emotional attributes to
the source while retaining its speaker and speech contents. The
A2A-ZEST framework consists of an analysis-synthesis pipeline,
where the analysis module decomposes speech into semantic
tokens, speaker representations, and emotion embeddings. Using
these representations, a pitch contour estimator and a...

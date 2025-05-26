# RECOPILOT : REVERSE ENGINEERING COPILOT IN BINARY ANALYSIS

## arXiv ID
2505.16366

## Authors
Guoqiang Chen, Huiqi Sun, Daguang Liu, Zhiqi Wang, Qiang Wang, Bin Yin, Lu Liu, Lingyun Ying

## Abstract
Binary analysis plays a pivotal role in security domains such as malware detection and vulnerability discovery, yet it remains labor-intensive and heavily reliant on expert knowledge. General-purpose large language models (LLMs) perform well in programming analysis on source code, while binary-specific LLMs are underexplored. In this work, we present ReCopilot, an expert LLM designed for binary analysis tasks. ReCopilot integrates binary code knowledge through a meticulously constructed dataset, encompassing continue pretraining (CPT), supervised fine-tuning (SFT), and direct preference optimization (DPO) stages. It leverages variable data flow and call graph to enhance context awareness and employs test-time scaling to improve reasoning capabilities. Evaluations on a comprehensive binary analysis benchmark demonstrate that ReCopilot achieves state-of-the-art performance in tasks such as function name recovery and variable type inference on the decompiled pseudo code, outperforming both existing tools and LLMs by 13%. Our findings highlight the effectiveness of domain-specific training and context enhancement, while also revealing challenges in building super long chain-of-thought. ReCopilot represents a significant step toward automating binary analysis with interpretable and scalable AI assistance in this domain.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.16366)
- [Download PDF](https://arxiv.org/pdf/2505.16366.pdf)

## Extracted Text
arXiv:2505.16366v1  [cs.CR]  22 May 2025RECOPILOT : REVERSE ENGINEERING COPILOT IN BINARY
ANALYSIS
Guoqiang Chen Huiqi Sun Daguang Liu Zhiqi Wang Qiang Wang
Bin Yin Lu Liu Lingyun Ying
{guoqiangchen, sunhuiqi, liudaguang, wangzhiqi, wangqiang10,
binyin, liulu01, yinglingyun}@qianxin.com
QI-ANXIN Technology Research Institute, Beijing, China
May 23, 2025
ABSTRACT
Binary analysis plays a pivotal role in security domains such as malware detection and vulnerability
discovery, yet it remains labor-intensive and heavily reliant on expert knowledge. General-purpose
large language models (LLMs) perform well in programming analysis on source code, while binary-
specific LLMs are underexplored. In this work, we present ReCopilot, an expert LLM designed
for binary analysis tasks. ReCopilot integrates binary code knowledge through a meticulously
constructed dataset, encompassing continue pretraining (CPT), supervised fine-tuning (SFT), and
direct preference optimization (DPO) stages. It leverages ...

# Backdoor Cleaning without External Guidance in MLLM Fine-tuning

## arXiv ID
2505.16916

## Authors
Xuankun Rong, Wenke Huang, Jian Liang, Jinhe Bi, Xun Xiao, Yiming Li, Bo Du, Mang Ye

## Abstract
Multimodal Large Language Models (MLLMs) are increasingly deployed in fine-tuning-as-a-service (FTaaS) settings, where user-submitted datasets adapt general-purpose models to downstream tasks. This flexibility, however, introduces serious security risks, as malicious fine-tuning can implant backdoors into MLLMs with minimal effort. In this paper, we observe that backdoor triggers systematically disrupt cross-modal processing by causing abnormal attention concentration on non-semantic regions—a phenomenon we term attention collapse. Based on this insight, we propose Believe Your Eyes (BYE), a data filtering framework that leverages attention entropy patterns as self-supervised signals to identify and filter backdoor samples. BYE operates via a three-stage pipeline: (1) extracting attention maps using the fine-tuned model, (2) computing entropy scores and profiling sensitive layers via bimodal separation, and (3) performing unsupervised clustering to remove suspicious samples. Unlike prior defenses, BYE requires no clean supervision, auxiliary labels, or model modifications. Extensive experiments across various datasets, models, and diverse trigger types validate BYE’s effectiveness: it achieves near-zero attack success rates while maintaining clean-task performance, offering a robust and generalizable solution against backdoor threats in MLLMs. Our code is publicly available at: https://github.com/XuankunRong/BYE.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.16916)
- [Download PDF](https://arxiv.org/pdf/2505.16916.pdf)

## Extracted Text
arXiv:2505.16916v1  [cs.CR]  22 May 2025Backdoor Cleaning without External Guidance
in MLLM Fine-tuning
Xuankun Rong1†, Wenke Huang1†, Jian Liang1, Jinhe Bi2, Xun Xiao3,
Yiming Li4, Bo Du1, Mang Ye1∗
1School of Computer Science, Wuhan University
2Munich Research Center
3Huawei Technologies
4Nanyang Technological University
{rongxuankun, wenkehuang, yemang}@whu.edu.cn
Abstract
Multimodal Large Language Models (MLLMs) are increasingly deployed in fine-
tuning-as-a-service (FTaaS) settings, where user-submitted datasets adapt general-
purpose models to downstream tasks. This flexibility, however, introduces serious
security risks, as malicious fine-tuning can implant backdoors into MLLMs with
minimal effort. In this paper, we observe that backdoor triggers systematically
disrupt cross-modal processing by causing abnormal attention concentration on
non-semantic regions—a phenomenon we term attention collapse . Based on this
insight, we propose Believe Your Eyes (BYE) , a data filtering fra...

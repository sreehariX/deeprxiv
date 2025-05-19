# LibIQ: Toward Real-Time Spectrum Classification in O-RAN dApps

## arXiv ID
2505.10537

## Authors
Filippo Olimpieri, Noemi Giustini, Andrea Lacava, Salvatore D’Oro, Tommaso Melodia, Francesca Cuomo

## Abstract
The O-RAN architecture is transforming cellular networks by adopting Radio Access Network (RAN) softwarization and disaggregation concepts to enable data-driven monitoring and control of the network. Such management is enabled by RAN Intelligent Controllers (RICs), which facilitate near-real-time and non-real-time network control through xApps and rApps. However, they face limitations, including latency overhead in data exchange between the RAN and RIC, restricting real-time monitoring, and the inability to access user plain data due to privacy and security constraints, hindering use cases like beamforming and spectrum classification. To address these limitations, several architectural proposals have been made, including dApps, i.e., applications deployed within the RAN unit that enable real-time inference, control and Radio Frequency (RF) spectrum analysis. In this paper, we leverage the dApps concept to enable real-time RF spectrum classification with LibIQ, a novel library for RF signals that facilitates efficient spectrum monitoring and signal classification by providing functionalities to read I/Q samples as time-series, create datasets and visualize time-series data through plots and spectrograms. Thanks to LibIQ, I/Q samples can be efficiently processed to detect external RF signals, which are subsequently classified using a Convolutional Neural Network (CNN) inside the library. To achieve accurate spectrum analysis, we created an extensive dataset of time-series-based I/Q samples, representing distinct signal types captured using a custom dApp running on a 5th generation (5G) deployment over the Colosseum network emulator and an Over-The-Air (OTA) testbed. We evaluate our model by deploying LibIQ in heterogeneous scenarios with varying center frequencies, time windows, and external RF signals. In real-time analysis, the model classifies the processed I/Q samples, achieving an average accuracy of approximately 97.8% in identifying signal types across all scenarios. We pledge to release both LibIQ and the dataset created as a publicly available framework upon acceptance.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.10537)
- [Download PDF](https://arxiv.org/pdf/2505.10537.pdf)

## Extracted Text
This paper has been accepted for publication on IEEE Mediterranean Communication and Computer Networking Conference (MedComNet 2025). This is the
author’s accepted version of the article. The final version published by IEEE is F. Olimpieri, N. Giustini, A. Lacava, S. D’Oro, T. Melodia, and F. Cuomo,
“LibIQ: Toward Real-Time Spectrum Classification in O-RAN dApps,” Proc. of IEEE Mediterranean Communication and Computer Networking Conference
(MedComNet) , Cagliari, Italy, 2025.
©2025 IEEE. Personal use of this material is permitted. Permission from IEEE must be obtained for all other uses, in any current or future media, including
reprinting/republishing this material for advertising or promotional purposes, creating new collective works, for resale or redistribution to servers or lists, or
reuse of any copyrighted component of this work in other works.LibIQ: Toward Real-Time Spectrum Classification
in O-RAN dApps
Filippo Olimpieri∗, Noemi Giustini∗, Andrea Lacava∗†, Salvatore D’Oro†, To...

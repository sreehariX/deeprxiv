# OPEN-RAG : Enhanced Retrieval-Augmented Reasoning with Open-Source Large Language Models

## arXiv ID
2410.01782

## Authors
Shayekh Bin Islam, Md Asib Rahman, K S M Tozammel Hossain, Enamul Hoque, Shafiq Joty, Md Rizwan Parvez

## Abstract
Retrieval-Augmented Generation (RAG) has been shown to enhance the factual accuracy of Large Language Models (LLMs), but existing methods often suffer from limited reasoning capabilities in effectively using the retrieved evidence, particularly when using open-source LLMs. To mitigate this gap, we introduce a novel framework, OPEN-RAG, designed to enhance reasoning capabilities in RAG with open-source LLMs. Our framework transforms an arbitrary dense LLM into a parameter-efficient sparse mixture of experts (MoE) model capable of handling complex reasoning tasks, including both single- and multi-hop queries. OPEN-RAG uniquely trains the model to navigate challenging distractors that appear relevant but are misleading. As a result, OPEN-RAG leverages latent learning, dynamically selecting relevant experts and integrating external knowledge effectively for more accurate and contextually relevant responses. In addition, we propose a hybrid adaptive retrieval method to determine retrieval necessity and balance the trade-off between performance gain and inference speed. Experimental results show that the Llama2-7B-based OPEN-RAG outperforms state-of-the-art LLMs and RAG models such as ChatGPT, Self-RAG, and Command R+ in various knowledge-intensive tasks. We open-source our code and models at https://openragmoe.github.io/

## Links
- [View on arXiv](https://arxiv.org/abs/2410.01782)
- [Download PDF](https://arxiv.org/pdf/2410.01782.pdf)

## Extracted Text
OPEN-RAG : Enhanced Retrieval-Augmented Reasoning with Open-Source
Large Language Models
Shayekh Bin Islam*,1,6,7, Md Asib Rahman*,1, K S M Tozammel Hossain2
Enamul Hoque3, Shafiq Joty4, Md Rizwan Parvez5
1Bangladesh University of Engineering and Technology,2University of North Texas
3York University, Canada,4Salesforce Research,5Qatar Computing Research Institute (QCRI)
6Fatima Al-Fihri Predoctoral Fellowship,7Cohere For AI Community
shayekh.bin.islam@gmail.com, mparvez@hbku.edu.qa
Abstract
Retrieval-Augmented Generation (RAG) has
been shown to enhance the factual accuracy of
Large Language Models (LLMs), but existing
methods often suffer from limited reasoning
capabilities in effectively using the retrieved
evidence, particularly when using open-source
LLMs. To mitigate this gap, we introduce a
novel framework, OPEN-RAG , designed to en-
hance reasoning capabilities in RAG with open-
source LLMs. Our framework transforms an
arbitrary dense LLM into a parameter-efficient
sparse mixtur...

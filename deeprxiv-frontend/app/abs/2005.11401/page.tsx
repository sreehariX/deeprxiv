'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  ExternalLink, 
  Download, 
  ChevronRight, 
  ChevronDown,
  Menu,
  FileText,
  BookOpen
} from 'lucide-react';
import Script from 'next/script';

// KaTeX CSS for equation rendering
const KatexCSS = () => (
  <>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css"
      integrity="sha384-GvrOXuhMATgEsSwCs4smul74iXGOixntILdUW9XmUC6+HX0sLNAK3q71HotJqlAn"
      crossOrigin="anonymous"
    />
  </>
);

// Paper data
const paperData = {
  arxiv_id: '2005.11401',
  title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
  authors: 'Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela',
  abstract: 'Large pre-trained language models have been shown to store factual knowledge in their parameters, and achieve state-of-the-art results when fine-tuned on downstream NLP tasks. However, their ability to access and precisely manipulate knowledge is still limited, and hence on knowledge-intensive tasks, their performance lags behind task-specific architectures. Additionally, providing provenance for their decisions and updating their world knowledge remain open research problems. Pre-trained models with a differentiable access mechanism to explicit non-parametric memory have so far been only investigated for extractive downstream tasks. We explore a general-purpose fine-tuning recipe for retrieval-augmented generation (RAG) — models which combine pre-trained parametric and non-parametric memory for language generation. We introduce RAG models where the parametric memory is a pre-trained seq2seq model and the non-parametric memory is a dense vector index of Wikipedia, accessed with a pre-trained neural retriever. We compare two RAG formulations, one which conditions on the same retrieved passages across the whole generated sequence, and another which can use different passages per token. We fine-tune and evaluate our models on a wide range of knowledge-intensive NLP tasks and set the state of the art on three open domain QA tasks, outperforming parametric seq2seq models and task-specific retrieve-and-extract architectures. For language generation tasks, we find that RAG models generate more specific, diverse and factual language than a state-of-the-art parametric-only seq2seq baseline.',
};

// Sections data
const sectionsData = [{"id": "abstract", "title": "Abstract", "content": "The \"Abstract\" section of the paper \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" presents a concise overview of the motivation, methodology, and key findings of the study with an academic and precise tone.\n\n**Key Points and Arguments:**\n\n- Large pre-trained language models (LMs) inherently store factual knowledge within their parameters and perform well on various downstream NLP tasks after fine-tuning.\n- Despite their strengths, these parametric models have limitations accessing, manipulating, and updating precise factual knowledge, especially in knowledge-intensive scenarios.\n- Providing provenance for model decisions and updating their knowledge bases dynamically remains a significant challenge.\n- Previous work on models with differentiable access to external non-parametric memory has mostly been confined to extractive tasks.\n- The paper proposes a general fine-tuning approach termed Retrieval-Augmented Generation (RAG), which synergistically combines parametric memory (a pre-trained seq2seq model) and non-parametric memory (a dense vector index of Wikipedia accessed by a neural retriever).\n\n**Methods and Techniques Described:**\n\n- The RAG model architecture features two key components: a parametric seq2seq generator model (based on BART) and a dense vector retriever (Dense Passage Retriever, DPR) operating over a large Wikipedia index.\n- Two formulations of RAG are compared:\n  - *RAG-Sequence,* which uses the same retrieved passage for generating the entire output sequence.\n  - *RAG-Token,* which allows different retrieved passages to influence the generation of different tokens in the output sequence.\n- The model is trained end-to-end by marginalizing over latent retrieved documents to maximize the likelihood of the output text.\n- The approach enables joint fine-tuning of both the retriever and generator without explicit supervision on which document to retrieve.\n\n**Important Findings and Results:**\n\n- RAG models achieve state-of-the-art results on multiple open-domain question answering (QA) benchmarks, including Natural Questions, WebQuestions, and CuratedTrec, surpassing specialized task-specific retrieval-and-extract pipelines and purely parametric seq2seq baselines.\n- For language generation tasks, including abstractive QA and Jeopardy question generation, RAG models generate more factual, specific, and diverse outputs.\n- The retrieval-augmented approach allows the model to generate correct answers even when the exact answer is not present verbatim in any retrieved document, demonstrating an advantage over pure extractive methods.\n- The paper also shows that updating the non-parametric memory (e.g., replacing the Wikipedia index) allows for dynamic updating of the model\u2019s world knowledge without retraining the entire system.\n\n**Implications:**\n\n- The combination of parametric and non-parametric memories in RAG enables overcoming limitations of standard pre-trained LMs by integrating explicit, updatable external knowledge sources.\n- RAG\u2019s architecture provides a promising direction for enhancing knowledge-intensive NLP tasks, offering better factual accuracy, interpretability (through retrieved passages), and adaptability to changing information.\n- The findings suggest that generative models, when augmented with retrieval, can outperform both pure parametric models and traditional extractive retrieval-reader pipelines.\n- The approach offers practical benefits in terms of maintaining up-to-date knowledge through memory index replacement rather than costly full model retraining, which is highly relevant for real-world applications where knowledge evolves rapidly.\n\nIn summary, the Abstract effectively captures the motivation to improve knowledge access and manipulation in language models, introduces the novel RAG methodology combining learned retrieval with generative sequence modeling, and highlights strong empirical results demonstrating the superiority and flexibility of retrieval-augmented generation for knowledge-intensive NLP tasks. This sets a foundation for advancing NLP systems that require precise, updatable, and interpretable knowledge integration beyond static parametric models[Paper Abstract]. This conception aligns with broader industry understanding of RAG as a method to enhance large language models by connecting them to external, authoritative knowledge bases to improve accuracy and relevance of generated content[1][5].", "citations": ["https://aws.amazon.com/what-is/retrieval-augmented-generation/", "https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/", "https://cloud.google.com/use-cases/retrieval-augmented-generation", "https://www.youtube.com/watch?v=T-D1OfcDW1M", "https://www.ibm.com/think/topics/retrieval-augmented-generation"]}, {"id": "introduction", "title": "Introduction", "content": "The *Introduction* section of the paper \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" presents a comprehensive overview of the motivations, challenges, and the proposed approach in combining parametric and non-parametric memory for improved performance in knowledge-intensive natural language processing (NLP) tasks. Below is a detailed analysis structured according to the requested points:\n\n### Key Points and Arguments\n\n- **Limitations of Large Pre-trained Language Models**: The introduction highlights that while large pre-trained language models (LMs) effectively store vast amounts of knowledge within their parameters and achieve strong downstream task performance, they suffer from critical limitations. These include difficulty in expanding or revising stored knowledge, lack of interpretability of their predictions, and a tendency to hallucinate or produce incorrect information without clear provenance.\n\n- **Motivation for Hybrid Models**: To overcome these drawbacks, the paper motivates the use of *hybrid memory models* that combine:\n  - *Parametric memory* (knowledge embedded in model parameters)\n  - *Non-parametric memory* (explicit retrieval-based memory from external knowledge sources)\n  \n  Such hybrid models allow revisable and inspectable knowledge access, enabling updates to the knowledge base and providing interpretable retrieval evidence for generated outputs.\n\n- **Novelty in Application to Generative Seq2Seq Models**: Existing approaches incorporating retrieval-augmented mechanisms focused primarily on extractive tasks. This work extends this paradigm to *generative sequence-to-sequence (seq2seq) models* for natural language generation, which is a significant advancement and broadens the applicability of retrieval-augmented techniques.\n\n- **Approach Overview**:\n  - The parametric memory is instantiated as a pre-trained seq2seq transformer model (BART).\n  - The non-parametric memory consists of a dense vector index of Wikipedia documents, accessed via a neural retriever (Dense Passage Retriever, DPR).\n  - The paper proposes a general-purpose fine-tuning strategy for these Retrieval-Augmented Generation (RAG) models.\n  \n  This integration is designed for end-to-end training, enabling the model to jointly learn retrieval and generation.\n\n### Methods and Techniques Described\n\n- **RAG Model Architecture**: The RAG model uses two key components:\n  - A *retriever* (DPR) that encodes queries and documents into dense vectors to retrieve relevant knowledge passages from Wikipedia.\n  - A *generator* (BART-large) that conditions its generation on both the input query and the retrieved documents.\n  \n- **Probabilistic Marginalization over Retrieved Documents**: Two formulations of RAG are introduced:\n  - *RAG-Sequence*: The model generates the entire output sequence conditioned on the same retrieved document.\n  - *RAG-Token*: The model can condition each token of the output on potentially different retrieved documents, allowing more fine-grained integration of knowledge across multiple sources.\n  \n- **End-to-End Joint Fine-Tuning**: The retriever and generator are jointly fine-tuned on target NLP tasks, optimizing the marginal likelihood of the generated outputs by treating the retrieved documents as latent variables.\n\n- **Non-parametric Memory Indexing**: The external memory uses a large Wikipedia dump split into chunks, indexed using Maximum Inner Product Search (MIPS) for efficient retrieval.\n\n### Important Findings and Results Summarized in Introduction\n\n- **State-of-the-Art Performance**: RAG models achieve state-of-the-art results on several open-domain question answering (QA) benchmarks such as Natural Questions, WebQuestions, CuratedTrec, and TriviaQA by outperforming both parametric-only seq2seq baselines and task-specific retrieve-and-extract architectures.\n\n- **Improved Generation Quality**: For knowledge-intensive natural language generation tasks, RAG models produce outputs that are more factual, specific, and diverse compared to strong parametric baseline models.\n\n- **Flexibility and Updatability**: The non-parametric memory component allows easy updating of world knowledge by swapping the index without retraining the entire model, addressing the limitations of static frozen knowledge in parametric models.\n\n### Implications of the Information in This Section\n\n- The introduction frames Retrieval-Augmented Generation as a promising approach to bridge the gap between static parametric knowledge stored in language models and dynamic, explicit knowledge bases accessible via retrieval. This hybrid method addresses key issues like knowledge updating, fact-checking, and interpretability, which are critical for deploying trustworthy and up-to-date AI systems in knowledge-intensive applications.\n\n- By applying retrieval augmentation to generative models rather than just extractive QA systems, the paper opens new avenues for more flexible and accurate natural language generation that can produce informative and contextually grounded text, benefiting tasks such as open-domain QA, fact verification, and question generation.\n\n- The successful end-to-end fine-tuning strategy presented suggests a general-purpose recipe for other researchers and practitioners to integrate retrieval-based knowledge sources with large pre-trained generative models, facilitating wider adoption and adaptation across NLP tasks.\n\n- The approach offers a cost-effective alternative to continual retraining of large language models to keep them current, as knowledge updates can be achieved by maintaining and refreshing the external document index.\n\n---\n\nThis *Introduction* section lucidly sets up the rationale and foundation for the RAG model, clearly articulating the problem landscape, the methodological innovation, and the promising empirical outcomes that justify the subsequent detailed technical exposition and experiments in the paper.", "citations": ["https://aws.amazon.com/what-is/retrieval-augmented-generation/", "https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/", "https://cloud.google.com/use-cases/retrieval-augmented-generation", "https://www.youtube.com/watch?v=T-D1OfcDW1M", "https://www.ibm.com/think/topics/retrieval-augmented-generation"]}, {"id": "methods", "title": "Methods", "content": "The \"Methods\" section of the paper on Retrieval-Augmented Generation (RAG) comprehensively details the model architecture, training, and inference procedures for combining retrieval and generation components in knowledge-intensive natural language processing (NLP) tasks.\n\n**Key Points and Arguments**\n\n- RAG integrates two main components: a retriever and a generator. The retriever is a bi-encoder (based on Dense Passage Retrieval, DPR) that retrieves a top-K set of relevant documents from an indexed external knowledge base (Wikipedia) given an input query. The generator is a pre-trained seq2seq model (BART-large) that produces output tokens conditioned on both the input query and the retrieved documents.\n  \n- Two variants are proposed:  \n  - **RAG-Sequence**: uses the same retrieved document for the entire output sequence generation, treating the document as a single latent variable marginalized over top-K retrieved documents.  \n  - **RAG-Token**: allows choosing different documents per output token, enabling more flexible and fine-grained aggregation of information from multiple documents.\n  \n- Both retriever and generator are fine-tuned jointly end-to-end by marginalizing over latent retrieved documents without explicit supervision on which documents to retrieve.\n\n- Decoding differs between the two variants. RAG-Token naturally fits beam search with marginalization, whereas RAG-Sequence requires a more complex \"Thorough Decoding\" procedure to approximate maximum likelihood decoding by combining beam search results across documents.\n\n**Methods and Techniques**\n\n- **Retriever**: DPR bi-encoder uses BERT encoders to produce dense embeddings for queries and documents, employing Maximum Inner Product Search (MIPS) for efficient retrieval of top-K relevant documents. The retriever is initialized from pre-trained DPR models and fine-tuned only on the query encoder, while the document encoder and index remain fixed to avoid costly re-indexing during training.\n\n- **Generator**: BART-large, a 400M-parameter pre-trained seq2seq Transformer, generates sequences by concatenating the input query with retrieved passages as context, leveraging its denoising pre-training for strong performance.\n\n- **Training**: The model maximizes the marginal likelihood over retrieved documents given an input-output pair, using stochastic gradient descent with Adam. The retrieved document is treated as a latent variable marginalized during training, allowing joint optimization of retriever and generator without direct retrieval supervision.\n\n- **Decoding**:  \n  - For RAG-Token, token probabilities marginalize over documents during beam search straightforwardly.  \n  - For RAG-Sequence, decoding requires running beam search per document and then marginalizing over document probabilities, either with a \"Thorough\" approach that recomputes missing probabilities or a \"Fast\" approximation.\n\n**Important Findings or Results** (from broader paper context)\n\n- RAG achieves state-of-the-art or competitive performance on multiple knowledge-intensive NLP tasks including open-domain QA, abstractive QA, question generation, and fact verification.\n\n- The ability to marginalize over retrieved documents allows RAG to generate correct answers even when the exact answer does not appear verbatim in any single retrieved document, outperforming extractive-only methods.\n\n- RAG-Token often outperforms RAG-Sequence on generation diversity and factuality due to its ability to flexibly attend to multiple documents at the token level.\n\n- Joint training of retriever and generator improves retrieval quality and downstream generation, compared to frozen or traditional retrieval baselines.\n\n**Implications**\n\n- The combination of parametric memory (pre-trained seq2seq model) and non-parametric memory (external document retrieval) creates a flexible model that can incorporate up-to-date knowledge dynamically without expensive retraining, addressing limitations of purely parametric models.\n\n- Treating retrieved documents as latent variables and marginalizing during training and decoding is an effective technique to handle retrieval uncertainty and improve generative performance.\n\n- The RAG framework generalizes across different task types (generation, classification) and retrieval setups, enabling broad applicability to knowledge-intensive NLP challenges.\n\n- The design facilitates transparency and provenance since the generator explicitly conditions on retrieved documents, allowing inspection of evidence behind generated outputs.\n\nIn summary, the Methods section presents a novel, well-founded architecture and training approach for retrieval-augmented generation that leverages end-to-end optimization over latent retrieved documents, balancing retrieval and generation to improve knowledge-grounded NLP performance. The section carefully details the underpinnings of RAG models, their two variants, and the associated training and decoding techniques essential for practitioners implementing or extending these models.", "citations": ["https://cohere.com/blog/rag-architecture", "https://aws.amazon.com/what-is/retrieval-augmented-generation/", "https://nexla.com/ai-infrastructure/retrieval-augmented-generation/", "https://dev.to/ankush_mahore/retrieval-augmented-generation-rag-architecture-nmb", "https://weaviate.io/blog/introduction-to-rag"]}, {"id": "experiments", "title": "Experiments", "content": "The \"Experiments\" section of the paper \u201cRetrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\u201d presents a comprehensive evaluation framework for the proposed Retrieval-Augmented Generation (RAG) models across multiple challenging NLP tasks that require rich factual knowledge. The key points, methodologies, findings, and implications from this section are summarized below:\n\n## Key Points and Arguments\n- The section covers diverse knowledge-intensive NLP tasks all leveraging a single Wikipedia dump as a non-parametric knowledge source.\n- Tasks include open-domain question answering (QA), abstractive QA, open-domain Jeopardy question generation, and fact verification.\n- The experiments showcase the flexibility of RAG models in combining parametric memory (pre-trained seq2seq models) with non-parametric memory (retrieval from Wikipedia) to improve knowledge access.\n- Experimental comparison is made against extractive QA models, closed-book generation models, and task-specific architectures, highlighting RAG\u2019s strong performance and generalizability.\n- Fact verification is modeled as sequence classification without retrieval supervision, underscoring RAG\u2019s ability to learn retrieval jointly without explicit evidence labels.\n\n## Methods and Techniques\n- A single Wikipedia dump (December 2018) is split into ~21M 100-word chunks serving as the document index (non-parametric memory).\n- A pre-trained Dense Passage Retriever (DPR) encodes queries and documents into dense vectors to retrieve top-K relevant passages for each input.\n- Two RAG variants are fine-tuned end-to-end:\n  - **RAG-Sequence**: Conditions on the same retrieved passage for generating the entire output sequence.\n  - **RAG-Token**: Allows conditioning on different documents per generated token, enabling fine-grained document utilization.\n- The generator is a BART-large seq2seq transformer concatenating inputs with retrieved passages.\n- Training minimizes negative marginal log-likelihood over retrieved documents treated as latent variables.\n- Tasks and datasets:\n  - **Open-domain QA:** Natural Questions, TriviaQA, WebQuestions, CuratedTrec.\n  - **Abstractive QA:** MS-MARCO NLG task, treating it as open-domain abstractive QA without accessing gold passages.\n  - **Jeopardy Question Generation:** Generating precise, factual Jeopardy-style questions conditioned on answers, evaluated via automatic Q-BLEU-1 metric and human judgments for factuality and specificity.\n  - **Fact Verification:** FEVER dataset, posed as sequence classification (supports/refutes/not enough info) without supervised retrieval of evidence.\n\n## Important Findings and Results\n- RAG models set new state-of-the-art (SOTA) performance on three open-domain QA tasks, outperforming both parametric-only and specialized retrieve-and-extract models.\n- Generation flexibility allows RAG to answer correctly even when the exact answer is not found verbatim in retrieved passages, unlike extractive models.\n- On MS-MARCO abstractive QA, RAG-Sequence outperforms BART by 2.6 BLEU points and approaches SOTA despite not using gold passages.\n- For Jeopardy question generation, RAG-Token surpasses BART in both automatic metrics and human-rated factuality and specificity, demonstrating enhanced factual and diverse generation.\n- In fact verification on FEVER, RAG achieves accuracy within 4.3% of complex SOTA pipeline systems that use retrieval supervision, despite RAG\u2019s unsupervised retrieval training.\n- Ablations show learning retrieval yields better performance than fixed retrievers; dense vector retrieval outperforms classical BM25 retrieval for most tasks.\n- RAG\u2019s non-parametric memory can be swapped to update knowledge without retraining, enabling adaptation to world changes (e.g., different Wikipedia snapshots).\n- Generation diversity analysis shows RAG models produce more diverse outputs than BART without additional decoding heuristics.\n\n## Implications\n- The experiments validate RAG as a powerful, flexible framework that combines parametric and non-parametric knowledge effectively for a wide variety of knowledge-intensive NLP tasks.\n- The ability to jointly train retriever and generator without explicit retrieval supervision simplifies model design and broadens applicability.\n- Generation-based approaches outperform extractive methods even on extractive QA benchmarks, suggesting that unconstrained generation can better integrate evidence from multiple sources.\n- Updating the knowledge base by replacing the document index (non-parametric memory) offers an efficient alternative to retraining large parametric models.\n- Improved factuality and specificity in generation tasks have practical impact on downstream applications requiring precise and reliable language generation.\n- The findings emphasize the advantage of retrieval-augmented generation for tasks beyond QA, including question generation and fact verification, opening avenues for broader use in knowledge-grounded NLP.\n\nIn summary, this section demonstrates that RAG models, through end-to-end fine-tuning of retriever and generator components over a Wikipedia-based knowledge store, achieve superior performance and enhanced generation quality across a spectrum of challenging, real-world knowledge-intensive NLP problems[1][2].", "citations": ["https://arxiv.org/pdf/2005.11401", "https://proceedings.neurips.cc/paper/2020/file/6b493230205f780e1bc26945df7481e5-Paper.pdf", "https://arxiv.org/abs/2005.11401", "https://github.com/AkariAsai/evidentiality_qa", "https://aclanthology.org/2022.emnlp-main.346.pdf"]}, {"id": "results", "title": "Results", "content": "The \"Results\" section of the paper presents a comprehensive evaluation of Retrieval-Augmented Generation (RAG) models across multiple knowledge-intensive natural language processing tasks, highlighting their state-of-the-art performance, methodological innovations, and practical implications.\n\n**1. Key Points and Arguments:**\n- RAG models achieve new state-of-the-art results on several open-domain question answering (QA) datasets, surpassing both extractive and closed-book baselines.\n- They demonstrate particular strengths in generating correct answers by leveraging partial or indirect clues from retrieved documents, which extractive methods cannot fully exploit.\n- In abstractive QA tasks, RAG approaches state-of-the-art performance without using gold (human-annotated) passages, producing answers that are more factual and less prone to hallucination compared to baseline models like BART.\n- For the challenging task of Jeopardy question generation, the RAG-Token variant outperforms both RAG-Sequence and BART models, with human evaluations confirming RAG's superior factuality and specificity.\n- On fact verification (FEVER), RAG models achieve competitive accuracy close to state-of-the-art pipeline systems, despite lacking retrieval supervision.\n- Additional analyses reveal that RAG provides greater diversity in generated outputs, benefits from end-to-end learned retrieval, and supports knowledge updating by swapping the retrieval index without retraining.\n\n**2. Methods or Techniques Described:**\n- Two RAG model variants are explored: RAG-Sequence (uses a single retrieved document for the entire generated sequence) and RAG-Token (allows different documents to influence the generation of each token).\n- The retriever component uses a dense passage retriever (DPR) based on BERT encoders to retrieve top-K relevant documents from a large Wikipedia index.\n- The generator is based on BART-large, a pre-trained seq2seq transformer, which conditions on both the input query and retrieved documents by concatenation.\n- The training minimizes a marginal log-likelihood over latent retrieved documents, jointly fine-tuning the query encoder and the generator, while keeping the document encoder fixed for efficiency.\n- Decoding strategies differ for RAG-Sequence (Thorough and Fast Decoding) and RAG-Token (standard beam search marginalizing over retrieved documents).\n- Human evaluation protocols assess factuality and specificity in generated questions.\n\n**3. Important Findings or Results:**\n- On open-domain QA datasets (Natural Questions, TriviaQA, WebQuestions, CuratedTrec), RAG surpasses prior models including DPR, REALM, and large closed-book T5 models, with exact match improvements (e.g., NQ EM score of 44.5% for RAG-Sequence).\n- RAG generates correct answers even when the exact answer is not contained verbatim in any retrieved document, showing an 11.8% accuracy in such cases on NQ.\n- In abstractive QA on MSMARCO, RAG outperforms a BART baseline by 2.6 BLEU and ROUGE-L points, approaching models that have access to gold passages.\n- For Jeopardy question generation, RAG-Token is superior, with human assessments indicating it produces more factual and specific questions than BART.\n- Fact verification accuracy on FEVER with RAG reaches within 4.3% of the best pipeline models despite no retrieval supervision, and top retrieved documents frequently overlap with annotated evidence.\n- RAG models exhibit higher n-gram diversity in generated text compared to BART, indicating more varied language output.\n- Ablation studies confirm learned retrieval substantially improves performance compared to freezing the retriever or using a traditional BM25 retriever.\n- Knowledge updates are feasible by swapping the non-parametric Wikipedia index (e.g., using a 2016 vs. 2018 dump) without retraining, with performance aligned to the currency of the index.\n\n**4. Implications:**\n- The results demonstrate that combining parametric and non-parametric memory in generative models enables robust and flexible knowledge retrieval and usage, setting new performance standards in QA and generation tasks.\n- RAG's ability to generate answers from indirect clues and produce less hallucinated, more factual responses suggests practical advantages over purely extractive or closed-book approaches.\n- The token-level marginalization in RAG-Token enhances complex generation tasks like question generation, supporting multi-document synthesis.\n- Competitive fact verification without retrieval supervision indicates RAG's applicability in real-world settings where annotated evidence is scarce.\n- The model's architecture supporting easy knowledge updating through index swapping addresses critical issues of model obsolescence and maintenance in dynamic knowledge environments.\n- Overall, RAG provides a general-purpose framework that can be fine-tuned end-to-end for diverse knowledge-intensive tasks, advancing the integration of retrieval and generation in NLP.\n\nThis analysis confirms RAG's significant contribution to knowledge-intensive NLP by delivering state-of-the-art results, new methodological insights, and operational advantages over prior methods.", "citations": ["https://arxiv.org/abs/2406.05794", "https://openreview.net/forum?id=45aMpeVvXB", "https://aclanthology.org/2023.tacl-1.1/", "https://arxiv.org/html/2406.05794v1", "https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00530/114590/Improving-the-Domain-Adaptation-of-Retrieval"]}, {"id": "related-work", "title": "Related Work", "content": "The \"Related Work\" section of the paper \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" provides a comprehensive contextualization of the presented research within the existing literature on retrieval mechanisms in natural language processing (NLP). The section articulates several key points, describes relevant methods, and clarifies the unique contribution of the paper with implications for the field.\n\n## Key Points and Arguments\n\n- The section begins by situating the research within prior work on retrieval mechanisms applied to individual NLP tasks such as open-domain question answering (QA), fact checking, and dialogue systems. This acknowledges the breadth of prior research focusing on task-specific retrieval approaches.\n\n- It then reviews general-purpose pre-trained language model architectures, namely BERT, BART, and T5, highlighting their limitations when used without explicit retrieval mechanisms. Specifically, these large pre-trained models encode knowledge in their parameters but can struggle with precise knowledge access, updating knowledge, and providing provenance for generated information.\n\n- The section discusses learned retrieval methods and memory-based architectures that have been previously proposed to augment language models. This includes Dense Passage Retrieval (DPR), memory networks, and retrieve-and-edit approaches, which enhance a model\u2019s access to external knowledge through various retrieval strategies.\n\n- The authors emphasize the key distinction of their work: the combination of a pre-trained generative sequence-to-sequence (seq2seq) model with a differentiable neural retriever. This integration forms a unified retrieval-augmented generation (RAG) framework that is applicable across multiple knowledge-intensive NLP tasks, rather than being task-specific.\n\n## Methods or Techniques Described\n\n- The related work section contrasts this paper\u2019s approach with existing architectures. While many prior approaches use retrieval only for extractive tasks or require task-specific training from scratch, this work uses pre-trained components (a seq2seq transformer as a parametric memory and a dense vector index accessed via a neural retriever as non-parametric memory).\n\n- The retrieval is implemented via the Dense Passage Retriever (DPR), a bi-encoder architecture that enables efficient Maximum Inner Product Search (MIPS) over a large document corpus (e.g., Wikipedia), enabling latent document retrieval conditioned on the input query.\n\n- The generator is based on BART, a pre-trained seq2seq transformer, which generates text conditioned both on the input query and retrieved documents by concatenation.\n\n- Two model variants are presented: RAG-Sequence, which uses the same retrieved document to generate the entire output sequence, and RAG-Token, which can condition each generated token on a potentially different retrieved document, allowing more flexible use of retrieved knowledge.\n\n- The entire system (retriever and generator) is fine-tuned end-to-end by marginalizing over the latent retrieved documents, without requiring direct supervision on the retrieval step.\n\n## Important Findings or Results (as related to Related Work context)\n\n- Although not detailed extensively in the related work itself, the section serves to frame the originality of the RAG approach, which extends retrieval-augmented methods beyond extractive QA to generative seq2seq tasks.\n\n- The combination of pre-trained retrieval and generation components without additional domain-specific or task-specific architectural changes or training offers state-of-the-art or competitive results across a variety of knowledge-intensive tasks.\n\n## Implications of the Information in this Section\n\n- This related work positioning underscores the novelty and versatility of the RAG framework, which moves beyond previous limitations of pre-trained models lacking retrieval or retrieval models designed only for specific tasks.\n\n- By unifying retrieval and generation with differentiable learning, the approach enables better factual grounding, easier knowledge updates, and interpretable knowledge access compared to purely parametric models.\n\n- The use of pre-trained retrievers and generators allows leveraging large existing resources and architectures, leading to improvements in accuracy, robustness, and efficiency on tasks where external knowledge is vital.\n\n- The framework\u2019s generality implies potential for broad applicability in NLP tasks requiring knowledge-intensive reasoning and language generation, setting a foundation for further research in retrieval-augmented generative modeling.\n\nIn summary, the \"Related Work\" section highlights that while prior research has focused on retrieval for specific NLP tasks or on non-generative models, this paper\u2019s unique contribution is the integration of pre-trained seq2seq generation with a differentiable neural retriever for a unified, flexible retrieval-augmented generation framework applicable to diverse knowledge-intensive tasks. This positions the work as an important evolution in combining parametric and non-parametric memory sources for enhanced natural language understanding and generation.", "citations": ["https://research.ibm.com/blog/retrieval-augmented-generation-RAG", "https://en.wikipedia.org/wiki/Retrieval-augmented_generation", "https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/", "https://arxiv.org/abs/2005.11401", "https://www.datastax.com/guides/what-is-retrieval-augmented-generation"]}, {"id": "discussion-and-future-work", "title": "Discussion and Future Work", "content": "The \"Discussion and Future Work\" section of the paper emphasizes several key points regarding the advantages, findings, and prospective directions for Retrieval-Augmented Generation (RAG) models that integrate hybrid parametric and non-parametric memory for knowledge-intensive NLP tasks.\n\n**Key Points and Arguments Presented**\n\n- The section highlights the multifaceted benefits of combining parametric memory (pre-trained generative language models) and non-parametric memory (retrieval of external documents) in generative models. This hybrid approach leads to improved factuality, specificity, and interpretability in generated outputs.\n- It stresses the unique capability of RAG to dynamically update knowledge without retraining the entire model, a significant advantage over purely parametric models whose knowledge is fixed post-training.\n- The discussion recognizes that this combination addresses core challenges in knowledge-intensive NLP, such as providing precise and interpretable responses and reducing hallucinations common in purely parametric generative models.\n- Authors propose future research directions that include joint pre-training of the retriever and generator components from scratch rather than fine-tuning pre-trained models separately. They also call for a deeper investigation into the interactions and synergies between parametric and non-parametric memory components.\n- Extending the application of hybrid memory models broadly across NLP tasks beyond those currently tested is suggested, implying confidence that the approach can generalize.\n\n**Methods and Techniques Described**\n\n- While the section summarizes results rather than detailing methods, it references the core methodology of RAG: leveraging pre-trained seq2seq transformers (parametric memory) augmented by a dense vector index of Wikipedia accessed through a neural retriever (non-parametric memory).\n- It mentions two formulations of RAG\u2014RAG-Sequence and RAG-Token\u2014that differ in how retrieved passages are used during generation: either conditioning on one document per sequence or potentially different documents per output token.\n- The retriever and generator are fine-tuned jointly end-to-end to optimize the marginal likelihood of target outputs, treating retrieved documents as latent variables.\n\n**Important Findings or Results**\n\n- RAG models achieve state-of-the-art performance on multiple open-domain question answering datasets and outperform parametric-only or extractive retrieval-based baselines.\n- The hybrid approach leads to more factual and specific language generation, as confirmed in both quantitative metrics and human evaluations (e.g., Jeopardy question generation).\n- The ability to swap or update the non-parametric memory index without retraining the model demonstrates dynamic knowledge updating capacity.\n- RAG also approaches strong performance in fact verification tasks, closely matching sophisticated pipeline systems but without requiring retrieval supervision.\n\n**Implications of the Information in this Section**\n\n- The section implies that combining parametric and non-parametric memory in generative models is a promising direction to overcome limitations of both purely parametric and purely retrieval-based systems.\n- The dynamic update capability implies better adaptability to changing real-world knowledge, a crucial requirement for practical NLP applications.\n- It encourages the NLP research community to further explore joint training and deeper memory interaction mechanisms to unlock broader and more powerful uses of hybrid memory architectures.\n- Given the demonstrated improvements in interpretability, factuality, and specificity, such hybrid models could become foundational for future knowledge-intensive AI systems requiring trustworthy and updatable language generation.\n\nIn sum, the \"Discussion and Future Work\" section reflects confidence in the hybrid memory approach of RAG models, summarizing their empirical strengths and setting an agenda for advancing the joint training and integration of parametric and non-parametric memories to extend their applicability and performance across NLP tasks[5].", "citations": ["https://www.mdpi.com/2078-2489/15/1/37", "https://ai.plainenglish.io/the-statistical-showdown-parametric-vs-non-parametric-machine-learning-models-e384b08faf0b", "https://quanting-xie.github.io/Embodied-RAG-web/", "https://research.aimultiple.com/retrieval-augmented-generation/", "https://arxiv.org/pdf/2005.11401"]}, {"id": "broader-impact", "title": "Broader Impact", "content": "The \"Broader Impact\" section of the paper \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" presents a balanced discussion on both the societal benefits and potential risks of the proposed Retrieval-Augmented Generation (RAG) models.\n\n**Key Points and Arguments:**\n\n- The section emphasizes the societal benefits of RAG models, notably their ability to reduce hallucinations\u2014instances where AI generates plausible but false or misleading information\u2014and improve factual grounding by leveraging external knowledge sources such as Wikipedia. This improvement in factual accuracy is especially valuable for sensitive domains like medical and professional applications where correctness is critical[1][2][5].\n\n- The authors also acknowledge risks associated with their approach. Since RAG relies on external knowledge bases, biases or inaccuracies present in these sources (e.g., Wikipedia) can propagate or even amplify through the model\u2019s outputs. Another risk highlighted is the potential misuse of the technology for generating misleading or harmful content, which could exacerbate misinformation problems.\n\n- Concerns about job automation are also mentioned, reflecting broader societal impacts of increasingly capable AI systems in automating tasks traditionally performed by humans.\n\n- To mitigate these risks, the authors call for the development and integration of AI tools designed to reduce misuse and misinformation. These measures could include better grounding mechanisms, retrieval and generation checks, or policy and technical safeguards.\n\n**Methods or Techniques Described:**\n\n- While the section itself is conceptual, it relates directly to the technical approach of RAG, which integrates pre-trained seq2seq models with a dense vector index of Wikipedia accessed via a neural retriever. This combination grounds generated responses in actual retrieved documents, enhancing factual accuracy and reducing hallucinations compared to parametric-only models[1][2].\n\n**Important Findings or Results:**\n\n- The empirical results presented elsewhere in the paper demonstrate that RAG models produce responses that are more factual, diverse, and specific compared to standard language models like BART. They also outperform extractive and closed-book QA approaches on multiple benchmark datasets.\n\n- The ability to update the model's knowledge by swapping out the non-parametric memory (Wikipedia index) without retraining underscores how RAG can maintain up-to-date factual grounding, addressing a common limitation of purely parametric models.\n\n**Implications:**\n\n- The section illustrates that RAG and similar retrieval-augmented models represent a significant advancement toward more reliable, factually grounded AI systems, which is crucial for real-world applications requiring precision and trustworthiness.\n\n- However, these models do not eliminate risks entirely. They inherit and can amplify the biases and inaccuracies within their external knowledge sources, necessitating continuous efforts in responsible AI development and deployment.\n\n- The recognition of these broader societal impacts signals that technical progress in AI must be accompanied by ethical, policy, and practical measures to ensure positive outcomes, prevent misuse, and address labor market concerns.\n\nIn summary, the \"Broader Impact\" section highlights how Retrieval-Augmented Generation models can substantially improve factual accuracy and utility in knowledge-intensive tasks while simultaneously recognizing and calling attention to inherent risks and the need for mitigation strategies to maximize societal benefit.", "citations": ["https://www.k2view.com/blog/what-is-grounding-and-hallucinations-in-ai/", "https://www.ada.cx/blog/grounding-and-hallucinations-in-ai-taming-the-wild-imagination-of-artificial-intelligence", "https://cloud.google.com/discover/what-are-ai-hallucinations", "https://libguides.library.arizona.edu/ai-literacy-instructors/verify-facts", "https://en.wikipedia.org/wiki/Hallucination_(artificial_intelligence)"]}];

// Citations data
const citationsData = ["https://trophiccascades.forestry.oregonstate.edu/sites/default/files/Lafferty_WritingScientificPaper.pdf", "https://www.enago.com/academy/how-can-you-create-structured-research-paper-outline/", "https://library.piedmont.edu/c.php?g=521348&p=3564598", "https://academics.umw.edu/writing-fredericksburg/files/2011/09/Basic-Outlines.pdf", "https://www.scribbr.com/research-paper/outline/"];

export default function PaperPage() {
  const [activeSection, setActiveSection] = useState(sectionsData[0]?.id);
  const [activeSubsection, setActiveSubsection] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  const activeSectionRef = useRef(null);
  
  // Initialize section expansion state
  useEffect(() => {
    const initialExpandedSections = {};
    sectionsData.forEach(section => {
      initialExpandedSections[section.id] = true;
    });
    setExpandedSections(initialExpandedSections);
  }, []);
  
  // Scroll to the active section when it changes
  useEffect(() => {
    if (activeSectionRef.current) {
      activeSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeSection, activeSubsection]);
  
  // Initialize KaTeX for equation rendering
  useEffect(() => {
    const renderMathInElement = window.katex?.renderMathInElement;
    if (renderMathInElement) {
      document.querySelectorAll('.math-content').forEach(el => {
        renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      });
    }
  }, [activeSection, activeSubsection]);

  // Find the active section content
  const currentSection = sectionsData.find(section => section.id === activeSection);
  const currentSubsection = activeSubsection
    ? currentSection?.subsections?.find(sub => sub.id === activeSubsection)
    : null;
  
  const contentToDisplay = currentSubsection
    ? currentSubsection.content
    : currentSection?.content;
  
  // Get citations for the current section/subsection
  const currentCitations = currentSubsection?.citations || currentSection?.citations || [];
  
  // Function to render citations
  const renderCitations = () => {
    if (citationsData.length === 0 || currentCitations.length === 0) return null;
    
    return (
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">References</h3>
        <ol className="list-decimal pl-5 space-y-2">
          {currentCitations.map((citationIndex) => {
            const citation = citationsData[citationIndex];
            return (
              <li key={citationIndex} className="text-sm text-gray-700 dark:text-gray-300">
                <a 
                  href={citation?.url || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline break-words"
                >
                  {citation?.title || citation?.url || `Citation ${citationIndex + 1}`}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };
  
  // Function to toggle section expansion
  const toggleSectionExpand = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };
  
  // Function to render content with headings, lists, code blocks, and equations
  const renderContent = (content) => {
    if (!content) return null;
    
    // Split content into paragraphs
    const paragraphs = content.split('\n\n');
    
    return paragraphs.map((paragraph, idx) => {
      // Check if it's a heading with #
      if (paragraph.startsWith('# ')) {
        const headingText = paragraph.substring(2);
        return (
          <h2 id={`heading-${idx}`} key={idx} className="text-xl font-bold mt-6 mb-3 text-gray-800 dark:text-gray-200">
            {headingText}
          </h2>
        );
      } 
      // Check if it's a subheading with ##
      else if (paragraph.startsWith('## ')) {
        const headingText = paragraph.substring(3);
        return (
          <h3 id={`subheading-${idx}`} key={idx} className="text-lg font-semibold mt-5 mb-2 text-gray-700 dark:text-gray-300">
            {headingText}
          </h3>
        );
      }
      // Check if it's a list
      else if (paragraph.match(/^[*-] /m)) {
        const listItems = paragraph.split(/\n[*-] /);
        return (
          <ul key={idx} className="list-disc pl-6 mb-4 text-gray-700 dark:text-gray-300">
            {listItems.map((item, i) => {
              // First item might still have the bullet
              const cleanItem = i === 0 ? item.replace(/^[*-] /, '') : item;
              return <li key={i} className="mb-1 math-content">{cleanItem}</li>;
            })}
          </ul>
        );
      }
      // Check if it's a code block
      else if (paragraph.startsWith('```') && paragraph.endsWith('```')) {
        const langMatch = paragraph.match(/^```(\w+)/);
        const language = langMatch ? langMatch[1] : '';
        const code = paragraph.substring(3 + language.length, paragraph.length - 3);
        
        return (
          <div key={idx} className="bg-gray-100 dark:bg-gray-800/50 rounded-md p-3 my-4 overflow-x-auto font-mono text-sm">
            {language && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-sans">{language}</div>
            )}
            <pre>{code}</pre>
          </div>
        );
      }
      // Regular paragraph with math support
      else {
        return (
          <p key={idx} className="mb-4 text-gray-700 dark:text-gray-300 math-content leading-relaxed">
            {paragraph}
          </p>
        );
      }
    });
  };
  
  return (
    <>
      <KatexCSS />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"
        integrity="sha384-cpW21h6RZv/phavutF+AuVYrr+dA8xD9zs6FwLpaCct6O9ctzYFfFr4dgmgccOTx"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"
        integrity="sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/" 
                className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span className="font-medium">DeepRxiv</span>
              </Link>
              
              <div className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                {paperData.arxiv_id}
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <a 
                href={`https://arxiv.org/abs/${paperData.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                <span>arXiv</span>
              </a>
              
              <a 
                href={`https://arxiv.org/pdf/${paperData.arxiv_id}.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                <span>PDF</span>
              </a>
              
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar with sections - collapsible on mobile */}
          <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}>
            <div className="py-6 px-4">
              <div className="mb-6">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Paper Info</h3>
                
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    arXiv ID: {paperData.arxiv_id}
                  </div>
                  
                  {paperData.authors && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Authors</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                        {paperData.authors}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Sections</h3>
              <nav className="space-y-1">
                {sectionsData.map(section => (
                  <div key={section.id} className="mb-2">
                    <div className="flex items-start">
                      <button
                        onClick={() => toggleSectionExpand(section.id)}
                        className="mr-1 mt-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {expandedSections[section.id] ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      
                      <button
                        onClick={() => {
                          setActiveSection(section.id);
                          setActiveSubsection(null);
                        }}
                        className={`flex w-full items-center py-1.5 text-sm font-medium rounded-md ${
                          activeSection === section.id && !activeSubsection
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }`}
                      >
                        {section.title}
                      </button>
                    </div>
                    
                    {/* Subsections */}
                    {expandedSections[section.id] && section.subsections && section.subsections.length > 0 && (
                      <div className="pl-6 mt-1 space-y-1">
                        {section.subsections.map(subsection => (
                          <button
                            key={subsection.id}
                            onClick={() => {
                              setActiveSection(section.id);
                              setActiveSubsection(subsection.id);
                            }}
                            className={`flex w-full items-center pl-2 py-1 text-xs font-medium rounded-md ${
                              activeSection === section.id && activeSubsection === subsection.id
                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            <ChevronRight className="w-3 h-3 mr-1 opacity-70" />
                            {subsection.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 overflow-auto">
            {/* Paper header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-6">
              <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-5 text-gray-900 dark:text-white math-content">
                  {paperData.title}
                </h1>
                
                {paperData.abstract && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700 rounded-lg p-4">
                    <h2 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-2">Abstract</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300 math-content leading-relaxed">
                      {paperData.abstract}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Section content */}
            <div className="py-8 px-4">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mb-8">
                  <BookOpen className="w-4 h-4" />
                  <span>
                    {currentSubsection 
                      ? `${currentSection?.title} / ${currentSubsection.title}` 
                      : currentSection?.title}
                  </span>
                </div>
                
                <div ref={activeSectionRef} className="prose dark:prose-invert max-w-none">
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-5">
                    {currentSubsection ? currentSubsection.title : currentSection?.title}
                  </h2>
                  
                  <div className="math-content">
                    {renderContent(contentToDisplay)}
                  </div>
                  
                  {renderCitations()}
                </div>
              </div>
            </div>
          </div>
          
          {/* Right sidebar with "On this page" (TOC) - desktop only */}
          <div className="hidden lg:block w-56 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
            <div className="py-6 px-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">On this page</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    activeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 block mb-2"
                >
                  {currentSubsection ? currentSubsection.title : currentSection?.title}
                </button>
                
                {/* TOC will be simpler here since we don't have the detailed content */}
                <div className="pl-2 border-l border-gray-200 dark:border-gray-700">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {paperData.arxiv_id}
                    </div>
                  </div>
                </div>
              </nav>
              
              {/* Metadata */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium mb-3">Source</h3>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <a 
                    href={`https://arxiv.org/abs/${paperData.arxiv_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    <span>arxiv.org/abs/{paperData.arxiv_id}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

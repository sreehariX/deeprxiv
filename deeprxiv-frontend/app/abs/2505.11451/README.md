# Extracting Explainable Dates From Medical Images By Reverse-Engineering UNIX Timestamps

## arXiv ID
2505.11451

## Authors
Lee Harris, James Bentham, Philippe De Wilde

## Abstract
Dates often contribute towards highly impactful medical decisions, but it is rarely clear how to extract this data. AI has only just begun to be used to transcribe such documents, and common methods are either to trust that the output produced by a complex AI model, or to parse the text using regular expressions. Recent work has established that regular expressions are an explainable form of logic, but it is difficult to decompose these into the component parts that are required to construct precise UNIX timestamps. First, we test publicly-available regular expressions, and we found that these were unable to capture a significant number of our dates. Next, we manually created easily-decomposable regular expressions, and we found that these were able to detect the majority of real dates, but also a lot of sequences of text that looked like dates. Finally, we used regular expression synthesis to automatically identify regular expressions from the reverse-engineered UNIX timestamps that we created.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.11451)
- [Download PDF](https://arxiv.org/pdf/2505.11451.pdf)

## Extracted Text
arXiv:2505.11451v1  [cs.AI]  16 May 2025Extracting Explainable Dates From Medical Images
By Reverse-Engineering UNIX Timestamps
Lee Harris
The University of Kent, Canterbury, UK
&
TMLEP Research, Ashford, UK
lah46@kent.ac.ukJames Bentham
School of Mathematics, Statistics and Physics
Newcastle University, Newcastle, UK
james.bentham@newcastle.ac.ukPhilippe De Wilde
The University of Kent
Canterbury, UK
p.dewilde@kent.ac.uk
Abstract —Dates often contribute towards highly impactful
medical decisions, but it is rarely clear how to extract this data.
AI has only just begun to be used transcribe such documents, and
common methods are either to trust that the output produced
by a complex AI model, or to parse the text using regular
expressions. Recent work has established that regular expressions
are an explainable form of logic, but it is difficult to decompose
these into the component parts that are required to construct
precise UNIX timestamps. First, we test publicly-available regular
exp...

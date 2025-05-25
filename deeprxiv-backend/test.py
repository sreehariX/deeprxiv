import requests

url = "https://api.perplexity.ai/chat/completions"

payload = {
    "model": "sonar",
    "messages": [
        {
            "role": "system",
            "content": "Be precise and concise."
        },
        {
            "role": "user",
            "content": "How many stars are there in our galaxy?"
        }
    ]
}
headers = {
    "Authorization": "Bearer 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",
    "Content-Type": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

print(response.text)


# {"id": "c3088a84-c467-4cb0-88eb-b16bb9e814f8", "model": "sonar", "created": 1747113806, "usage": {"prompt_tokens": 14, "completion_tokens": 181,
#  "total_tokens": 195, "search_context_size": "low"}, "citations": ["https://imagine.gsfc.nasa.gov/science/objects/milkyway1.html", 
#  "https://www.esa.int/Science_Exploration/Space_Science/Herschel/How_many_stars_are_there_in_the_Universe", 
#  "https://www.space.com/25959-how-many-stars-are-in-the-milky-way.html", "https://www.youtube.com/watch?v=Py2nZYmvTKg", "https://bigthink.com/starts-with-a-bang/overestimated-stars-in-universe/"], "object": "chat.completion", "choices": [{"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": "The Milky Way galaxy, which is the galaxy that contains our Solar System, is estimated to have approximately between 100 billion and 400 billion stars. More commonly cited estimates center around 100 billion stars, but more recent assessments, including data from ESA's Gaia mission, suggest the figure could be higher, up to about 400 billion stars[1][2][3][4].\n\nThis wide range exists because counting stars directly is very challenging due to the vastness of the galaxy, the varying sizes and types of stars, and observational limitations from our position inside the galaxy. The Milky Way is a barred spiral galaxy about 100,000 light years in diameter, and the Sun is located roughly 25,000 light years from its center[1][3].\n\nIn summary, the best scientific estimates currently place the number of stars in the Milky Way at roughly 100 to 400 billion stars."}, "delta": {"role": "assistant", "content": ""}}]}
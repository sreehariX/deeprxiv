import requests

url = "https://api.perplexity.ai/chat/completions"

payload = {
    "model": "sonar",
    "return_images": True,
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
    "Authorization": "Bearer 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", #demo key dont worry to use this haha
    "Content-Type": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

print(response.text)



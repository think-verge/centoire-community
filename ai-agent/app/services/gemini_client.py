from langchain_google_genai import ChatGoogleGenerativeAI


def get_llm() -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        temperature=0,
    )

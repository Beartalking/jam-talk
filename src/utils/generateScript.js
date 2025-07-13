// Generate a native English speaker script using OpenAI API
export async function generateScript(word) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY environment variable.');
  }

  const prompt = `You are a native English speaker helping non-native speakers practice English. 

Create a natural speaking script about the word "${word}". 

Requirements:
- Write in a conversational, natural tone as if you're a native English speaker
- Include personal thoughts, experiences, or opinions about the topic
- Use varied sentence structures and natural transitions
- Include some common phrases and idioms that native speakers use
- Keep it to approximately 120 words (concise but complete)
- Make it engaging and relatable
- Use vocabulary and expressions that are natural for native speakers
- Focus on the most important aspects of the topic

Topic: ${word}

Please write a 120-word script that sounds like a native English speaker talking naturally about this topic:`;

  const messages = [
    { role: 'system', content: 'You are a native English speaker creating natural, conversational scripts for English language learners.' },
    { role: 'user', content: prompt }
  ];

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 250,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating script:', error);
    throw error;
  }
} 
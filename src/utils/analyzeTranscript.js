// Analyze a transcript using OpenAI API with a structured Chinese prompt
export async function analyzeTranscript(transcript) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please set VITE_OPENAI_API_KEY environment variable.');
  }

  const prompt = `你是一个专业的英语口语教练，请根据以下要求对用户的英语口语转录文本进行分析和反馈。\n\n输出结构（严格遵守并使用中文讲解）:\n\n🌿 原始转录\n<逐字罗列用户文本，不做任何改动>\n\n✏️ 语法建议\n\n❌ 原句: ...\n✅ 建议: ...\n💡 解释（中文）: ...\n\n(如有多句，则以上述格式逐一列出)\n\n💬 词汇升级\n\n❌ 原词: ...\n✅ 建议: ... （中文释义: ...）\n\n(如有多句，则以上述格式逐一列出)\n\n🔈 发音提示\n\n单词: ...  \n❌ 问题: /æ/ 发成 /e/  \n✅ 中文提示: 可以把口形放大，舌尖放低\n\n⭐️ 一句话总结（中文）\n<20 字内，给出最重要的改进方向>\n\n🌟 额外要求\n\t•\t绝不修改「🌿 原始转录」区块的任何字符、大小写或标点。\n\t•\t每个建议都用简体中文解释，但保留必要英文单词/短语。\n\t•\t语法与词汇最多各列 3 条，发音最多 2 条，保证反馈精简易吸收。\n\t•\t若用户传来的文本不足 10 个单词，礼貌提醒他们再录一次（仍用中文）。\n\t•\t不回答与口语练习无关的问题；如有，礼貌引导回到下一轮关键词练习。\n\n用户转录文本如下：\n${transcript}`;

  const messages = [
    { role: 'system', content: '你是一个专业的英语口语教练。' },
    { role: 'user', content: prompt }
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze transcript');
  }

  const data = await response.json();
  return data.choices[0].message.content;
} 
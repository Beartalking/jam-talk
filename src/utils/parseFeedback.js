// Parse structured feedback from OpenAI into sections
export function parseFeedback(feedback) {
  const sections = {
    originalTranscript: '',
    grammar: [],
    vocabulary: [],
    pronunciation: [],
    summary: ''
  };

  // Split by main sections
  const parts = feedback.split(/(?=🌿|✏️|💬|🔈|⭐️)/);

  parts.forEach(part => {
    if (part.includes('🌿 原始转录')) {
      sections.originalTranscript = part.replace('🌿 原始转录', '').trim();
    } else if (part.includes('✏️ 语法建议')) {
      const grammarText = part.replace('✏️ 语法建议', '').trim();
      sections.grammar = parseGrammarSuggestions(grammarText);
    } else if (part.includes('💬 词汇升级')) {
      const vocabText = part.replace('💬 词汇升级', '').trim();
      sections.vocabulary = parseVocabSuggestions(vocabText);
    } else if (part.includes('🔈 发音提示')) {
      const pronText = part.replace('🔈 发音提示', '').trim();
      sections.pronunciation = parsePronunciationTips(pronText);
    } else if (part.includes('⭐️ 一句话总结')) {
      sections.summary = part.replace('⭐️ 一句话总结（中文）', '').replace('⭐️ 一句话总结', '').trim();
    }
  });

  return sections;
}

function parseGrammarSuggestions(text) {
  const suggestions = [];
  const items = text.split(/(?=❌ 原句:)/);
  
  items.forEach(item => {
    if (item.trim()) {
      const lines = item.split('\n').filter(line => line.trim());
      let original = '', suggestion = '', explanation = '';
      
      lines.forEach(line => {
        if (line.includes('❌ 原句:')) {
          original = line.replace('❌ 原句:', '').trim();
        } else if (line.includes('✅ 建议:')) {
          suggestion = line.replace('✅ 建议:', '').trim();
        } else if (line.includes('💡 解释')) {
          explanation = line.replace(/💡 解释[^:]*:/, '').trim();
        }
      });
      
      if (original || suggestion || explanation) {
        suggestions.push({ original, suggestion, explanation });
      }
    }
  });
  
  return suggestions;
}

function parseVocabSuggestions(text) {
  const suggestions = [];
  const items = text.split(/(?=❌ 原词:)/);
  
  items.forEach(item => {
    if (item.trim()) {
      const lines = item.split('\n').filter(line => line.trim());
      let original = '', suggestion = '';
      
      lines.forEach(line => {
        if (line.includes('❌ 原词:')) {
          original = line.replace('❌ 原词:', '').trim();
        } else if (line.includes('✅ 建议:')) {
          suggestion = line.replace('✅ 建议:', '').trim();
        }
      });
      
      if (original || suggestion) {
        suggestions.push({ original, suggestion });
      }
    }
  });
  
  return suggestions;
}

function parsePronunciationTips(text) {
  const tips = [];
  const items = text.split(/(?=单词:)/);
  
  items.forEach(item => {
    if (item.trim()) {
      const lines = item.split('\n').filter(line => line.trim());
      let word = '', problem = '', tip = '';
      
      lines.forEach(line => {
        if (line.includes('单词:')) {
          word = line.replace('单词:', '').trim();
        } else if (line.includes('❌ 问题:')) {
          problem = line.replace('❌ 问题:', '').trim();
        } else if (line.includes('✅ 中文提示:')) {
          tip = line.replace('✅ 中文提示:', '').trim();
        }
      });
      
      if (word || problem || tip) {
        tips.push({ word, problem, tip });
      }
    }
  });
  
  return tips;
} 
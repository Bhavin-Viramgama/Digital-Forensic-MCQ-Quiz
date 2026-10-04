const fs = require('fs');
const path = require('path');

const quizDataDir = path.join(__dirname, 'Quiz Data');
const files = fs.readdirSync(quizDataDir).filter(f => f.endsWith('.txt'));

const chapters = [];

function splitOptions(text) {
  // Split on " A) " " B) " " C) " " D) " pattern at boundaries
  // We look for the pattern where a letter followed by ) appears after a space
  const options = [];
  
  // Find positions of A), B), C), D) that are option markers
  // They must appear in order A, B, C, D
  const markers = ['A)', 'B)', 'C)', 'D)'];
  const positions = [];
  
  for (const marker of markers) {
    // Find the first occurrence of this marker that makes sense
    let searchFrom = positions.length > 0 ? positions[positions.length - 1] + 2 : 0;
    let pos = text.indexOf(marker, searchFrom);
    if (pos === -1) return []; // Can't find all markers
    positions.push(pos);
  }
  
  for (let i = 0; i < 4; i++) {
    const start = positions[i] + 3; // Skip "X) "
    const end = i < 3 ? positions[i + 1] : text.length;
    options.push({
      letter: markers[i][0],
      text: text.substring(start, end).trim()
    });
  }
  
  return options;
}

for (const file of files) {
  const content = fs.readFileSync(path.join(quizDataDir, file), 'utf-8');
  const lines = content.split(/\r?\n/);

  const chapterMatch = file.match(/Chapter (\d+)\s+(.+)\.txt/);
  const chapterNum = chapterMatch ? parseInt(chapterMatch[1]) : 0;
  const chapterTitle = chapterMatch ? chapterMatch[2] : file.replace('.txt', '');

  const questions = [];
  let currentSection = '';

  // Join all content and split by question markers
  const fullText = lines.join('\n');
  
  // Find sections
  const sectionMap = {};
  const sectionRegex = /^#{1,2}\s+(Section\s+[A-Z]\s*[–-]\s*.+)/gm;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(fullText)) !== null) {
    const sectionName = sectionMatch[1].replace(/^Section\s+[A-Z]\s*[–-]\s*/i, '').trim();
    sectionMap[sectionMatch.index] = sectionName;
  }

  // Split by questions using Q<num>. pattern
  const questionRegex = /\nQ(\d+)\.\s+/g;
  const questionPositions = [];
  let qm;
  while ((qm = questionRegex.exec(fullText)) !== null) {
    questionPositions.push({ index: qm.index, num: parseInt(qm[1]), matchLen: qm[0].length });
  }

  for (let qi = 0; qi < questionPositions.length; qi++) {
    const qPos = questionPositions[qi];
    const nextPos = qi < questionPositions.length - 1 ? questionPositions[qi + 1].index : fullText.length;
    const qBlock = fullText.substring(qPos.index + qPos.matchLen, nextPos);

    // Determine section
    const sectionPositions = Object.keys(sectionMap).map(Number).sort((a, b) => a - b);
    let section = '';
    for (const sp of sectionPositions) {
      if (sp < qPos.index) section = sectionMap[sp];
    }

    // Find "Correct answer:" line
    const correctIdx = qBlock.indexOf('Correct answer:');
    if (correctIdx === -1) continue;

    const beforeCorrect = qBlock.substring(0, correctIdx).trim();
    const afterCorrect = qBlock.substring(correctIdx);

    // Extract correct answer
    const ansMatch = afterCorrect.match(/Correct answer:\s*([A-D])/);
    if (!ansMatch) continue;
    const correctAnswer = ansMatch[1];

    // Extract explanation
    const explMatch = afterCorrect.match(/Explanation:\s*([\s\S]*)/);
    let explanation = '';
    if (explMatch) {
      explanation = explMatch[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.match(/^(Data Forensics|3170725)/) && !l.match(/^&#x20;/) && !l.match(/^Q\d+/) && !l.match(/^#{1,2}\s/) && !l.match(/^#\s/))
        .join(' ')
        .trim();
    }

    // Split question text and options
    // Options typically start with "A) "
    const optionsStart = beforeCorrect.indexOf('\nA)');
    const optionsStartAlt = beforeCorrect.indexOf('A) ');
    
    let questionText, optionsText;
    
    if (optionsStart !== -1) {
      questionText = beforeCorrect.substring(0, optionsStart).trim();
      optionsText = beforeCorrect.substring(optionsStart).trim();
    } else if (optionsStartAlt !== -1 && optionsStartAlt > 10) {
      // Options might be on same line as part of question
      questionText = beforeCorrect.substring(0, optionsStartAlt).trim();
      optionsText = beforeCorrect.substring(optionsStartAlt).trim();
    } else {
      continue;
    }

    // Clean question text - remove sub-headers like "Q1-Q15 · Basic" etc.
    questionText = questionText.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.match(/^Q\d+[–-]Q\d+/) && !l.match(/^#{1,2}\s/) && !l.match(/^(Basic|Intermediate|Advanced)/) && !l.match(/^This section/))
      .join(' ')
      .trim();

    // Merge options text into single line
    const optionsOneLine = optionsText.split('\n').map(l => l.trim()).filter(l => l).join(' ');
    
    const options = splitOptions(optionsOneLine);
    
    if (options.length === 4) {
      questions.push({
        id: qPos.num,
        section,
        question: questionText,
        options,
        correctAnswer,
        explanation
      });
    }
  }

  chapters.push({
    id: chapterNum,
    title: `Chapter ${chapterNum}: ${chapterTitle}`,
    shortTitle: chapterTitle,
    questionCount: questions.length,
    questions
  });

  console.log(`Parsed ${file}: ${questions.length} questions`);
}

chapters.sort((a, b) => a.id - b.id);

const output = `// Auto-generated quiz data
const QUIZ_DATA = ${JSON.stringify(chapters, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, 'quiz-data.js'), output, 'utf-8');
console.log(`\nTotal: ${chapters.reduce((s, c) => s + c.questionCount, 0)} questions across ${chapters.length} chapters`);
console.log('Written to quiz-data.js');

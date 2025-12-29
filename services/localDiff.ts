/**
 * Local Diff Engine - Client-side word comparison for instant feedback
 * Provides preliminary analysis in <30ms before AI response arrives
 */

import { AnalysisToken } from '../types';

// Common error patterns to detect locally (no AI needed)
const COMMON_PATTERNS = {
    // Irregular past tense
    irregularPast: new Map([
        ['buyed', 'bought'], ['goed', 'went'], ['taked', 'took'],
        ['maked', 'made'], ['comed', 'came'], ['runned', 'ran'],
        ['seed', 'saw'], ['gived', 'gave'], ['writed', 'wrote'],
        ['eated', 'ate'], ['drinked', 'drank'], ['thinked', 'thought'],
        ['bringed', 'brought'], ['teached', 'taught'], ['catched', 'caught'],
        ['falled', 'fell'], ['feeled', 'felt'], ['leaved', 'left'],
        ['meeted', 'met'], ['payed', 'paid'], ['sayed', 'said'],
        ['selled', 'sold'], ['telled', 'told'], ['understanded', 'understood'],
    ]),

    // Vietlish patterns (subject + very + verb)
    vietlish: [
        /\bi\s+very\s+(like|love|want|need|hate)/i,
        /\bi\s+so\s+(like|love|want|need)/i,
        /\bvery\s+like\b/i,
        /\bvery\s+love\b/i,
    ],

    // Missing articles before countable nouns
    missingArticle: [
        /\b(is|was|have|has|need|want|buy|bought|see|saw)\s+(book|car|house|phone|computer|dog|cat|man|woman|child)\b/i,
    ],

    // Double negatives
    doubleNegative: [
        /\bdon'?t\s+\w+\s+nothing\b/i,
        /\bcan'?t\s+\w+\s+nothing\b/i,
        /\bnever\s+\w+\s+nothing\b/i,
    ],
};

export interface LocalDiffResult {
    tokens: AnalysisToken[];
    estimatedScore: number;
    hasErrors: boolean;
    confidence: number; // 0-1, how confident we are in local analysis
}

/**
 * Tokenize input into words with position tracking
 */
function tokenize(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Check if a word matches common error patterns
 */
function checkWord(word: string): { isError: boolean; correction?: string; errorType?: string; reason?: string } {
    const lowerWord = word.toLowerCase().replace(/[.,!?;:]+$/, '');

    // Check irregular past tense
    if (COMMON_PATTERNS.irregularPast.has(lowerWord)) {
        return {
            isError: true,
            correction: COMMON_PATTERNS.irregularPast.get(lowerWord),
            errorType: 'Ngữ pháp',
            reason: 'Động từ bất quy tắc'
        };
    }

    return { isError: false };
}

/**
 * Check for Vietlish patterns in the full text
 */
function checkVietlish(text: string): { start: number; end: number; reason: string }[] {
    const matches: { start: number; end: number; reason: string }[] = [];

    for (const pattern of COMMON_PATTERNS.vietlish) {
        const match = text.match(pattern);
        if (match && match.index !== undefined) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                reason: 'Lỗi Vietlish: dịch nguyên văn từ tiếng Việt'
            });
        }
    }

    return matches;
}

/**
 * Run local diff analysis on user input
 * Returns preliminary results in <30ms
 */
export function runLocalDiff(userInput: string, expectedHint?: string): LocalDiffResult {
    const startTime = performance.now();
    const words = tokenize(userInput);

    if (words.length === 0) {
        return {
            tokens: [],
            estimatedScore: 0,
            hasErrors: false,
            confidence: 0
        };
    }

    const tokens: AnalysisToken[] = [];
    let errorCount = 0;

    // Check each word
    for (const word of words) {
        const check = checkWord(word);

        if (check.isError) {
            errorCount++;
            tokens.push({
                text: word,
                status: 'error',
                correction: check.correction,
                errorType: check.errorType,
                explanation: check.reason
            });
        } else {
            // Mark as potentially correct (will be verified by AI)
            tokens.push({
                text: word,
                status: 'correct'
            });
        }
    }

    // Check for Vietlish patterns
    const vietlishMatches = checkVietlish(userInput);
    if (vietlishMatches.length > 0) {
        errorCount += vietlishMatches.length;
        // Mark affected tokens
        let charIndex = 0;
        for (let i = 0; i < tokens.length; i++) {
            const wordEnd = charIndex + tokens[i].text.length;
            for (const match of vietlishMatches) {
                if (charIndex >= match.start && charIndex < match.end) {
                    tokens[i].status = 'error';
                    tokens[i].errorType = 'Vietlish';
                    tokens[i].explanation = match.reason;
                }
            }
            charIndex = wordEnd + 1; // +1 for space
        }
    }

    // Estimate score based on error ratio
    const errorRatio = errorCount / Math.max(words.length, 1);
    const estimatedScore = Math.max(0, Math.round(100 - (errorRatio * 50)));

    // Confidence is lower for local analysis (AI will provide final verdict)
    const confidence = Math.min(0.6, 1 - errorRatio);

    const endTime = performance.now();
    if (import.meta.env.DEV) {
        console.log(`[LocalDiff] Analyzed in ${(endTime - startTime).toFixed(2)}ms`);
    }

    return {
        tokens,
        estimatedScore,
        hasErrors: errorCount > 0,
        confidence
    };
}

/**
 * Merge local diff with AI response
 * AI response takes precedence, but local diff provides instant feedback
 */
export function mergeWithAIResponse(
    localDiff: LocalDiffResult,
    aiTokens: AnalysisToken[]
): AnalysisToken[] {
    // If AI provided tokens, use those (they're more accurate)
    if (aiTokens && aiTokens.length > 0) {
        return aiTokens;
    }

    // Otherwise, return local diff tokens
    return localDiff.tokens;
}

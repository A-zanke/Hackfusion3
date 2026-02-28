// Fuzzy Medicine Name Matcher
const fuzz = require('fuzzball');

const fuzzyMedicineMatch = (userInput, medicines) => {
    const normalizedInput = userInput.toLowerCase().trim();
    
    // Try different matching strategies
    let bestMatch = null;
    let bestScore = 0;
    
    medicines.forEach(medicine => {
        const medicineName = medicine.name.toLowerCase();
        
        // 1. Exact match
        if (medicineName === normalizedInput) {
            return { medicine, score: 100, type: 'exact' };
        }
        
        // 2. Contains match
        if (medicineName.includes(normalizedInput) || normalizedInput.includes(medicineName)) {
            const score = Math.max(
                (normalizedInput.length / medicineName.length) * 100,
                (medicineName.includes(normalizedInput) ? 90 : 80)
            );
            if (score > bestScore) {
                bestMatch = medicine;
                bestScore = score;
            }
        }
        
        // 3. Fuzzy ratio match
        const ratio = fuzz.ratio(normalizedInput, medicineName);
        if (ratio > bestScore && ratio >= 70) { // 70% similarity threshold
            bestMatch = medicine;
            bestScore = ratio;
        }
        
        // 4. Token set ratio (better for partial matches)
        const tokenRatio = fuzz.token_set_ratio(normalizedInput, medicineName);
        if (tokenRatio > bestScore && tokenRatio >= 70) {
            bestMatch = medicine;
            bestScore = tokenRatio;
        }
    });
    
    if (bestMatch && bestScore >= 70) {
        return {
            medicine: bestMatch,
            score: bestScore,
            type: bestScore >= 95 ? 'exact' : bestScore >= 85 ? 'very_close' : 'close'
        };
    }
    
    return null;
};

module.exports = { fuzzyMedicineMatch };

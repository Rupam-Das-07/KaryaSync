from pypdf import PdfReader
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import io
import re

class ATSAnalyzer:
    def extract_text_from_pdf(self, file_bytes):
        """Helper to get raw string from the uploaded PDF."""
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return ""

    def calculate_score(self, resume_text, jd_text):
        """
        Use CountVectorizer to convert both texts into vectors.
        Calculate cosine_similarity.
        Return a score out of 100.
        """
        if not resume_text or not jd_text:
            return 0
            
        text_list = [resume_text, jd_text]
        cv = CountVectorizer()
        count_matrix = cv.fit_transform(text_list)
        match_percentage = cosine_similarity(count_matrix)[0][1] * 100
        return round(match_percentage, 2)

    def get_missing_keywords(self, resume_text, jd_text):
        """
        Use CountVectorizer(stop_words='english') on the JD Text to find the top 20 most frequent keywords.
        Check which of these keywords are NOT present in the resume_text.
        Return this list as missing_keywords.
        """
        if not jd_text:
            return []

        # Extract keywords from JD
        cv = CountVectorizer(stop_words='english', max_features=20)
        try:
            cv.fit([jd_text])
            keywords = cv.get_feature_names_out()
        except ValueError:
            # Handle case where JD might be empty or only stop words
            return []

        resume_lower = resume_text.lower()
        missing_keywords = []

        for keyword in keywords:
            # Simple check if keyword exists in resume
            # Using regex for word boundary check to avoid partial matches (e.g., "java" in "javascript")
            if not re.search(r'\b' + re.escape(keyword) + r'\b', resume_lower):
                missing_keywords.append(keyword)

        return missing_keywords

    def analyze(self, file_bytes, jd_text):
        """
        Orchestrates the analysis.
        Returns JSON with score and recommendations.
        """
        resume_text = self.extract_text_from_pdf(file_bytes)
        
        if not resume_text:
            return {
                "score": 0,
                "recommendations": ["Could not extract text from the uploaded PDF. Please ensure it is a valid text-based PDF."]
            }

        score = self.calculate_score(resume_text, jd_text)
        missing_keywords = self.get_missing_keywords(resume_text, jd_text)
        
        recommendations = []
        
        if missing_keywords:
            recommendations.append(f"Your resume is missing key terms found in the job description: {', '.join(missing_keywords[:5])}.")
        
        if score < 50:
            recommendations.append("Your resume has a low match score. Consider tailoring it more specifically to the job description.")
        elif score >= 80:
            recommendations.append("Great match! Your resume aligns well with the job description.")

        return {
            "score": score,
            "recommendations": recommendations,
            "missing_keywords": missing_keywords
        }

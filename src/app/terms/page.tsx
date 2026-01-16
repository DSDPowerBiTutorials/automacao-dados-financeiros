/**
 * Terms of Service Page
 * Required for QuickBooks and other third-party integrations compliance
 */

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Terms of Service | DSD Finance Hub",
    description: "Terms of Service for DSD Finance Hub - Financial Reconciliation Platform"
}

export default function TermsOfServicePage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto py-12 px-4 max-w-4xl">
                <div className="bg-white rounded-lg shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
                    <p className="text-gray-500 mb-8">Last updated: January 16, 2026</p>

                    <div className="prose prose-gray max-w-none space-y-8">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
                            <p className="text-gray-700">
                                By accessing or using DSD Finance Hub (&quot;the Service&quot;), you agree to be bound
                                by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms,
                                you may not access or use the Service.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
                            <p className="text-gray-700">
                                DSD Finance Hub is a financial reconciliation platform that connects to various
                                financial services (QuickBooks, Stripe, GoCardless, Braintree, and bank accounts)
                                to aggregate, reconcile, and report on financial transactions. The Service is
                                designed for business use to assist with financial management and accounting.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Account Registration</h2>
                            <p className="text-gray-700">
                                To use the Service, you must:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>Be authorized to access the financial data you connect</li>
                                <li>Provide accurate and complete registration information</li>
                                <li>Maintain the security of your account credentials</li>
                                <li>Notify us immediately of any unauthorized access</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User Responsibilities</h2>
                            <p className="text-gray-700 mb-3">You agree to:</p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li>Use the Service only for lawful purposes</li>
                                <li>Maintain accurate account credentials for connected services</li>
                                <li>Authorize only necessary data access permissions</li>
                                <li>Report any security concerns or breaches immediately</li>
                                <li>Comply with all applicable laws, regulations, and third-party terms</li>
                                <li>Not attempt to reverse engineer or compromise the Service</li>
                                <li>Not use the Service for any fraudulent or illegal activities</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Integrations</h2>
                            <p className="text-gray-700">
                                The Service integrates with third-party services including Intuit QuickBooks,
                                Stripe, GoCardless, and Braintree. Your use of these integrations is subject to:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>The terms of service of each respective provider</li>
                                <li>Authorization grants you provide during connection</li>
                                <li>Data access permissions you approve</li>
                            </ul>
                            <p className="text-gray-700 mt-3">
                                We are not responsible for the availability, accuracy, or functionality of
                                third-party services.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Accuracy</h2>
                            <p className="text-gray-700">
                                While we strive for accuracy in data synchronization and reconciliation,
                                DSD Finance Hub is a tool for reconciliation assistance. You are solely
                                responsible for:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>Verifying all financial data and reconciliation results</li>
                                <li>Making final decisions on financial matters</li>
                                <li>Maintaining proper accounting records</li>
                                <li>Consulting with qualified accountants or financial advisors</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Intellectual Property</h2>
                            <p className="text-gray-700">
                                The Service, including its design, features, and content, is owned by
                                Digital Smile Design and protected by intellectual property laws. You may not:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>Copy, modify, or distribute the Service</li>
                                <li>Reverse engineer or decompile any part of the Service</li>
                                <li>Use our trademarks without permission</li>
                                <li>Create derivative works based on the Service</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of Liability</h2>
                            <p className="text-gray-700">
                                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>The Service is provided &quot;AS IS&quot; without warranties of any kind</li>
                                <li>We are not liable for any indirect, incidental, or consequential damages</li>
                                <li>We are not liable for financial decisions made based on Service data</li>
                                <li>Our total liability shall not exceed the fees paid in the past 12 months</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Indemnification</h2>
                            <p className="text-gray-700">
                                You agree to indemnify and hold harmless Digital Smile Design from any claims,
                                damages, or expenses arising from your use of the Service, violation of these
                                Terms, or infringement of any third-party rights.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
                            <p className="text-gray-700 mb-3">
                                <strong>By You:</strong> You may stop using the Service and disconnect all
                                integrations at any time through the Settings page.
                            </p>
                            <p className="text-gray-700">
                                <strong>By Us:</strong> We reserve the right to suspend or terminate your access
                                if you violate these Terms, engage in fraudulent activity, or for any other
                                reason at our discretion with reasonable notice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Modifications</h2>
                            <p className="text-gray-700">
                                We may modify these Terms at any time. We will notify you of material changes
                                by posting the updated Terms and changing the &quot;Last updated&quot; date. Continued
                                use of the Service after changes constitutes acceptance of the modified Terms.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Governing Law</h2>
                            <p className="text-gray-700">
                                These Terms shall be governed by and construed in accordance with the laws of
                                Spain, without regard to conflict of law principles. Any disputes shall be
                                resolved in the courts of Madrid, Spain.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Severability</h2>
                            <p className="text-gray-700">
                                If any provision of these Terms is found to be unenforceable, the remaining
                                provisions shall continue in full force and effect.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">14. Contact</h2>
                            <p className="text-gray-700">
                                For questions about these Terms, please contact us at:
                            </p>
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                                <p className="text-gray-700">
                                    <strong>Digital Smile Design</strong><br />
                                    Email: <a href="mailto:legal@digitalsmiledesign.com" className="text-blue-600 hover:underline">legal@digitalsmiledesign.com</a><br />
                                    Website: <a href="https://www.dsdfinancehub.com" className="text-blue-600 hover:underline">www.dsdfinancehub.com</a>
                                </p>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

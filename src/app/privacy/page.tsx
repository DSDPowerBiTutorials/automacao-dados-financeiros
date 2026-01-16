/**
 * Privacy Policy Page
 * Required for QuickBooks and other third-party integrations compliance
 */

import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Privacy Policy | DSD Finance Hub",
    description: "Privacy Policy for DSD Finance Hub - Financial Reconciliation Platform"
}

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto py-12 px-4 max-w-4xl">
                <div className="bg-white rounded-lg shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
                    <p className="text-gray-500 mb-8">Last updated: January 16, 2026</p>

                    <div className="prose prose-gray max-w-none space-y-8">
                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
                            <p className="text-gray-700">
                                DSD Finance Hub (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting
                                your privacy. This Privacy Policy explains how we collect, use, disclose, and
                                safeguard your information when you use our financial reconciliation platform.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
                            <p className="text-gray-700 mb-3">
                                We collect financial transaction data from connected services solely for the
                                purpose of financial reconciliation and reporting:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li><strong>QuickBooks Data:</strong> Invoices, payments, customer information, and account balances</li>
                                <li><strong>Stripe Data:</strong> Payment transactions, charges, refunds, and payouts</li>
                                <li><strong>GoCardless Data:</strong> Direct debit mandates and payment collections</li>
                                <li><strong>Braintree Data:</strong> Payment transactions and settlement information</li>
                                <li><strong>Bank Statements:</strong> Transaction records uploaded by users</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li>Synchronize and display financial transactions from connected services</li>
                                <li>Perform automated reconciliation between different data sources</li>
                                <li>Generate financial reports, analytics, and insights</li>
                                <li>Maintain accurate accounting and bookkeeping records</li>
                                <li>Provide customer support and respond to inquiries</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Storage & Security</h2>
                            <p className="text-gray-700 mb-3">
                                We implement industry-standard security measures to protect your data:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li>All data is stored securely in Supabase with encryption at rest</li>
                                <li>HTTPS/TLS encryption for all data in transit</li>
                                <li>OAuth 2.0 secure authentication for third-party integrations</li>
                                <li>Access tokens are securely stored and automatically refreshed</li>
                                <li>Regular security audits and vulnerability assessments</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Third-Party Services</h2>
                            <p className="text-gray-700 mb-3">
                                We integrate with the following third-party services:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li><strong>Intuit QuickBooks:</strong> Accounting data synchronization (<a href="https://www.intuit.com/privacy/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Intuit Privacy Policy</a>)</li>
                                <li><strong>Stripe:</strong> Payment processing data (<a href="https://stripe.com/privacy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
                                <li><strong>GoCardless:</strong> Direct debit transactions (<a href="https://gocardless.com/privacy/" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">GoCardless Privacy Policy</a>)</li>
                                <li><strong>Braintree:</strong> Payment gateway data (<a href="https://www.braintreepayments.com/legal/braintree-privacy-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Braintree Privacy Policy</a>)</li>
                                <li><strong>Supabase:</strong> Database and authentication services</li>
                                <li><strong>Vercel:</strong> Application hosting</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Sharing</h2>
                            <p className="text-gray-700">
                                We do not sell, trade, or rent your personal or financial information to third parties.
                                We may share data only in the following circumstances:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>With your explicit consent</li>
                                <li>To comply with legal obligations or court orders</li>
                                <li>To protect our rights, privacy, safety, or property</li>
                                <li>In connection with a merger, acquisition, or sale of assets</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Data Retention</h2>
                            <p className="text-gray-700">
                                Financial data is retained for as long as necessary to provide our services
                                and comply with legal obligations. You can request data deletion at any time
                                by disconnecting integrations through the Settings page or contacting us directly.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
                            <p className="text-gray-700 mb-3">You have the right to:</p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700">
                                <li><strong>Access:</strong> Request a copy of your data</li>
                                <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
                                <li><strong>Erasure:</strong> Request deletion of your data</li>
                                <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                                <li><strong>Disconnect:</strong> Revoke access to any connected service at any time</li>
                                <li><strong>Withdraw Consent:</strong> Opt out of data processing</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disconnecting Services</h2>
                            <p className="text-gray-700">
                                You can disconnect any integrated service at any time through the Settings page
                                in your dashboard. When you disconnect a service:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                                <li>Access tokens are immediately revoked</li>
                                <li>We stop synchronizing new data from that service</li>
                                <li>Previously synced data can be deleted upon request</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cookies</h2>
                            <p className="text-gray-700">
                                We use essential cookies to maintain your session and preferences.
                                We do not use tracking or advertising cookies.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Policy</h2>
                            <p className="text-gray-700">
                                We may update this Privacy Policy from time to time. We will notify you of any
                                changes by posting the new Privacy Policy on this page and updating the
                                &quot;Last updated&quot; date.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
                            <p className="text-gray-700">
                                If you have any questions about this Privacy Policy or our data practices,
                                please contact us at:
                            </p>
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                                <p className="text-gray-700">
                                    <strong>Digital Smile Design</strong><br />
                                    Email: <a href="mailto:privacy@digitalsmiledesign.com" className="text-blue-600 hover:underline">privacy@digitalsmiledesign.com</a><br />
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

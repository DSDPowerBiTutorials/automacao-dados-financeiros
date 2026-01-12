import Link from "next/link";

export default function PlaceholderPage({
    title,
    description,
    backHref = "/dashboard",
    backLabel = "Voltar ao Dashboard",
}: {
    title: string;
    description?: string;
    backHref?: string;
    backLabel?: string;
}) {
    return (
        <div>
            <div className="page-header d-print-none">
                <div className="row g-2 align-items-center">
                    <div className="col">
                        <h2 className="page-title">{title}</h2>
                        {description ? <div className="text-muted mt-1">{description}</div> : null}
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-body">
                    <p className="mb-3">Página em construção.</p>
                    <Link href={backHref} className="btn btn-primary">
                        {backLabel}
                    </Link>
                </div>
            </div>
        </div>
    );
}

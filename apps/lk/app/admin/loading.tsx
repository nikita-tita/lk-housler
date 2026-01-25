export default function AdminLoading() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
                <div className="spinner" />
                <p style={{ color: 'var(--gray-500)' }}>Загрузка...</p>
            </div>
        </div>
    );
}

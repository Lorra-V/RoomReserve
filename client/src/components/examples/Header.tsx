import Header from '../Header';
import { ThemeProvider } from '../ThemeProvider';

export default function HeaderExample() {
  return (
    <ThemeProvider>
      <div>
        <Header />
        <div className="p-6">
          <p className="text-muted-foreground">Main content below header</p>
        </div>
      </div>
    </ThemeProvider>
  );
}

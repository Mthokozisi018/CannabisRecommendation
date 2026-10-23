import { ArrowRight, ChartNoAxesColumn, Check, Clock3, Cloud, FileText, LayoutDashboard, ShoppingCart, Sprout, UsersRound } from "lucide-react";
import { completeManagerWelcomeAction } from "@/app/dashboard/manager/welcome-actions";
import styles from "./ManagerActivationWelcome.module.css";

const benefits = [
  { icon: Clock3, title: "Save Time", detail: "Manage your store faster with an easy-to-use, all-in-one system." },
  { icon: ShoppingCart, title: "Better Customer Experiences", detail: "Serve your customers quickly and keep them coming back." },
  { icon: ChartNoAxesColumn, title: "Grow Your Business", detail: "Track sales, inventory and customers in real time." },
  { icon: FileText, title: "Make Smarter Decisions", detail: "Access clear reports and insights anytime." },
  { icon: UsersRound, title: "Improve Efficiency", detail: "Streamline daily operations and reduce manual work." },
  { icon: Cloud, title: "Reliable & Secure", detail: "Manage your operations with GreenChoice’s existing security protections." }
];

export function ManagerActivationWelcome() {
  return (
    <div className={styles.backdrop}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="activation-welcome-title" aria-describedby="activation-welcome-description">
        <div className={styles.wallpaper} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.content}>
          <header className={styles.brand}>
            <Sprout size={48} strokeWidth={2.1} aria-hidden="true" />
            <div><strong>Green<span>Choice</span></strong><small>Retail Management System</small></div>
          </header>

          <div className={styles.intro}>
            <h1 id="activation-welcome-title">Welcome to <span className={styles.celebration}>🎉</span><br /><span>GreenChoice!</span></h1>
            <h2>Your account is now active</h2>
            <p id="activation-welcome-description">Thank you for completing your onboarding and payment. You are now part of the GreenChoice family.</p>
          </div>

          <div className={styles.benefits} aria-label="GreenChoice benefits">
            {benefits.map(({ icon: Icon, title, detail }) => (
              <div className={styles.benefit} key={title}>
                <span className={styles.iconTile}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
                <div><h3>{title}</h3><p>{detail}</p></div>
              </div>
            ))}
          </div>
        </div>

        <aside className={styles.confirmation} aria-label="Account activation confirmation">
          <span className={styles.confirmationIcon}><Check size={20} strokeWidth={3} aria-hidden="true" /></span>
          <div><strong>Account Activated</strong><p>You&apos;re all set and ready to start using GreenChoice.</p></div>
        </aside>

        <form action={completeManagerWelcomeAction} className={styles.action}>
          <button type="submit"><LayoutDashboard size={19} aria-hidden="true" />Go to Dashboard<ArrowRight size={19} aria-hidden="true" /></button>
        </form>
      </section>
    </div>
  );
}

import { Icon } from './UI';
import './InfoPages.css';

export default function InfoPages({page, onNavigate}: {page: string; onNavigate: (path: string) => void}) {
  if (page === 'About') {
    return (
      <div className="info-page about-page">
        {/* SECTION 1: HERO */}
        <section className="about-hero">
          <div className="hero-pill">
            <Icon name="verified" />
            <span>OUR PURPOSE & PHILOSOPHY</span>
          </div>
          <h1>
            Guiding conscious explorers beyond the beaten trail to <em>India’s quiet wonders</em>.
          </h1>
          <p>
            We know you're looking for more than just a typical tourist trap. You crave authenticity, raw experiences, and stories that haven't been filtered through a thousand generic travel blogs. Wanderer is your compass to the India that exists off the beaten path.
          </p>
        </section>

        {/* SECTION 2: PILLARS / IMPACT */}
        <section className="about-metrics">
          <div className="metric-card">
            <div className="metric-icon"><Icon name="travel_explore" /></div>
            <h3>Discover the Unseen</h3>
            <p>We make room for quieter valleys, overlooked architecture, forests, villages, and places known best by the locals.</p>
          </div>
          <div className="metric-card">
            <div className="metric-icon"><Icon name="auto_stories" /></div>
            <h3>Keep Stories Alive</h3>
            <p>A place is more than a pin. Its traditions, food, and everyday life deserve context—and the people who carry those stories deserve respect.</p>
          </div>
          <div className="metric-card">
            <div className="metric-icon"><Icon name="eco" /></div>
            <h3>Travel Responsibly</h3>
            <p>Leave a lighter footprint. Discovery comes with responsibility. Protect wildlife, keep to permitted paths, and leave places as you found them.</p>
          </div>
        </section>

        {/* SECTION 3: THE SACRED CHARTER */}
        <section className="about-charter">
          <div className="charter-container">
            <div className="charter-header">
              <div className="charter-pill">
                <Icon name="gavel" />
                <span>THE SACRED CHARTER</span>
              </div>
              <h2>The Wanderers Traveler Pledge</h2>
              <p>When you journey with Wanderer, you commit to an ethos of preservation, deep respect, and cultural humility.</p>
            </div>
            
            <div className="charter-grid">
              <div className="charter-item">
                <h3>Leave No Trace</h3>
                <p>Carry out everything you bring in. Respect delicate ecosystems and stay on designated paths to protect local flora and fauna.</p>
              </div>
              <div className="charter-item">
                <h3>Cultural Humility</h3>
                <p>Engage with local communities respectfully. Ask for permission before taking photographs and dress appropriately for sacred sites.</p>
              </div>
              <div className="charter-item">
                <h3>Hyper-Local Economy</h3>
                <p>Direct your expenditure to family-run kitchens, resident guides, and traditional craft artisans without unfair bargaining.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: CTA */}
        <section className="about-action">
          <span className="action-eyebrow">BEGIN YOUR JOURNEY</span>
          <h2>Ready to discover the India most travelers never see?</h2>
          <p>Join our intimate circle of mindful travelers. Receive quiet monthly field dispatches, access unlisted vernacular homestays, and explore sacred landscapes with resident curators.</p>
          <div className="action-buttons">
            <button className="primary" onClick={() => onNavigate('Explore')}>
              <Icon name="compass_calibration"/> Plan a Journey
            </button>
          </div>
          <div className="action-trust">
            <span><Icon name="local_police" /> Gram Panchayat Partner Alliance</span>
            <span><Icon name="verified" /> Fair Trade Host Guarantee</span>
          </div>
        </section>
      </div>
    );
  }

  if (page === 'Terms') {
    return (
      <div className="info-page terms-page">
        <header className="info-header">
          <h1>Terms & Conditions</h1>
          <p>Please read these terms carefully before using Wanderer.</p>
        </header>

        <div className="terms-content">
          <section>
            <h3>1. Acceptance of terms</h3>
            <p>By accessing or using Wanderer, you agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree, please do not use our services.</p>
          </section>
          <section>
            <h3>2. Our Mission & Platform Purpose</h3>
            <p>Wanderer helps people discover destinations, plan trips, and keep a personal travel journal. We are dedicated to showcasing the hidden side of India. The current service is not a booking provider, emergency service, or guarantee of access.</p>
          </section>
          <section>
            <h3>3. Your Responsibilities</h3>
            <p>Check that your plans comply with local rules. Respect communities, wildlife, property, and religious sites. Obtain required permits and follow official closures. Never enter restricted land to earn a stamp or XP.</p>
          </section>
          <section>
            <h3>4. Travel Information & Safety</h3>
            <p>Descriptions, estimated budgets, opening hours, accessibility, safety information, and local services can change or contain errors. Verify important details with official sources and local providers before travel.</p>
          </section>
          <section>
            <h3>5. User-Generated Content</h3>
            <p>Private journal notes, ratings, and photos remain associated with your account. You retain ownership, but grant us a license to use it to operate the service. Only upload material you have the right to use.</p>
          </section>
          <section>
            <h3>6. Prohibited Misuse</h3>
            <p>Do not attempt unauthorized access, evade account protections, manipulate XP, disrupt services, or extract another person’s private data.</p>
          </section>
          <section>
            <h3>7. Liability</h3>
            <p>Wanderer is provided "as is". We are not liable for any damages, injury, or loss arising from your travel decisions based on our platform's information.</p>
          </section>
          <p className="terms-footer">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    );
  }

  return null;
}

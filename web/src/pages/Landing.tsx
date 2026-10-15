import { Link } from 'react-router-dom';

export function Landing() {
  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Group habit challenges with stakes</p>
        <h1>
          Skip the gym,
          <br />
          <span className="accent">pay the pot.</span>
        </h1>
        <p className="lead">
          Start a challenge with friends. Check in with photo proof, and your friends vote on it. Miss your weekly
          target and you lose points. The people who never miss split the pot.
        </p>
        <div className="row">
          <Link to="/signup" className="btn btn-big">
            Start a challenge, it's free
          </Link>
          <Link to="/login" className="link">
            I have an account
          </Link>
        </div>
      </section>

      <section className="steps">
        {[
          ['1', 'Set the rules', '"Gym 3× a week for 4 weeks, 50 points a miss." Share the invite link with your group chat.'],
          ['2', 'Prove it', 'Snap a photo when you do the thing. Your friends approve it or call you out.'],
          ['3', 'Settle up', 'Each week, anyone short of the target pays into the pot. Survivors split it at the end.'],
        ].map(([n, title, body]) => (
          <div className="card step" key={n}>
            <span className="step-n">{n}</span>
            <h3>{title}</h3>
            <p className="muted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

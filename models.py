from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    # future: add username/password if needed

class HPCProvider(db.Model):
    __tablename__ = 'providers'
    id = db.Column(db.Integer, primary_key=True)
    cores = db.Column(db.Integer, nullable=True)
    clock_speed = db.Column(db.Float, nullable=True)   # GHz
    memory = db.Column(db.Integer, nullable=True)      # MB
    available = db.Column(db.Boolean, default=True)

class CodeRequest(db.Model):
    __tablename__ = 'requests'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    cores = db.Column(db.Integer, nullable=False)
    clock_speed = db.Column(db.Float, nullable=False)
    memory = db.Column(db.Integer, nullable=False)
    code_text = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='OPEN')  # OPEN, BIDDING, SCHEDULED, DONE
    result_output = db.Column(db.Text, nullable=True)


class Bid(db.Model):
    __tablename__ = 'bids'
    id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('requests.id'), nullable=False)
    provider_id = db.Column(db.Integer, db.ForeignKey('providers.id'), nullable=False)
    price = db.Column(db.Float, nullable=False)
    accepted = db.Column(db.Boolean, default=False)

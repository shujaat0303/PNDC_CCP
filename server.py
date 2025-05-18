from flask import Flask, request, jsonify, abort
from flask_migrate import Migrate
from flask_cors import CORS
import os
from models import db, Client, HPCProvider, CodeRequest, Bid
from schemas import LoginSchema, SpecUploadSchema, CodeSubmitSchema
import datetime

app = Flask(__name__, instance_relative_config=True)
CORS(app)
basedir = os.path.abspath(os.path.dirname(__file__))
app.config.from_mapping(
    #SQLALCHEMY_DATABASE_URI = 'sqlite:///instance/marketplace.sqlite',
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'marketplace.sqlite'),
    SQLALCHEMY_TRACK_MODIFICATIONS = False,
)
db.init_app(app)
migrate = Migrate(app, db)

login_schema     = LoginSchema()
spec_schema      = SpecUploadSchema()
code_schema      = CodeSubmitSchema()

# ---- Authentication ----
@app.route('/login', methods=['POST'])
def login():
    data = login_schema.load(request.json)
    uid = data['id']
    if data['user_type'] == 'client':
        client = Client.query.get(uid)
        if not client:
            client = Client(id=uid)
            db.session.add(client)
            db.session.commit()
        return jsonify(message='Client logged in', client_id=uid)
    else:
        prov = HPCProvider.query.get(uid)
        if not prov:
            prov = HPCProvider(id=uid)
            db.session.add(prov)
            db.session.commit()
        return jsonify(message='Provider logged in', provider_id=uid)

# ---- Provider: upload specs ----
@app.route('/providers/<int:pid>/specs', methods=['POST'])
def upload_specs(pid):
    data = spec_schema.load({ **request.json, 'id': pid })
    prov = HPCProvider.query.get_or_404(pid)
    prov.cores       = data['cores']
    prov.clock_speed = data['clock_speed']
    prov.memory      = data['memory']
    prov.available   = True
    db.session.commit()
    return jsonify(message='Specs updated', provider_id=pid)

# ---- Client: submit code request ----
@app.route('/clients/<int:cid>/requests', methods=['POST'])
def submit_request(cid):
    data = code_schema.load({ **request.json, 'client_id': cid })
    # ensure client exists
    _ = Client.query.get_or_404(cid)
    req = CodeRequest(
        client_id  = cid,
        cores      = data['cores'],
        clock_speed= data['clock_speed'],
        memory     = data['memory'],
        code_text  = data['code_text']
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(
        message='Code request created',
        request_id=req.id,
        status=req.status
    ), 201

# ---- HPC: list open requests ----
@app.route('/providers/<int:pid>/requests', methods=['GET'])
def list_requests(pid):
    prov = HPCProvider.query.get_or_404(pid)
    if not prov.available:
        abort(400, 'Provider is currently unavailable')

    # allow both OPEN and BIDDING so multiple providers can bid
    open_reqs = CodeRequest.query.filter(
        CodeRequest.status.in_(['OPEN', 'BIDDING'])
    ).all()
    
    filtered = []
    for r in open_reqs:
        if (r.cores    <= prov.cores and
            r.clock_speed <= prov.clock_speed and
            r.memory   <= prov.memory):
            filtered.append(r)

    return jsonify([
        {
            'request_id': r.id,
            'client_id' : r.client_id,
            'cores'     : r.cores,
            'clock_speed': r.clock_speed,
            'memory'    : r.memory
        } for r in filtered
    ])

# ---- HPC: submit bid ----
@app.route('/providers/<int:pid>/requests/<int:rid>/bids', methods=['POST'])
def submit_bid(pid, rid):
    prov = HPCProvider.query.get_or_404(pid)
    req = CodeRequest.query.get_or_404(rid)
    if req.status != 'OPEN' and req.status != 'BIDDING':
        abort(400, 'Request not open for bidding')
    price = request.json.get('price')
    bid = Bid(request_id=rid, provider_id=pid, price=price)
    req.status = 'BIDDING'
    db.session.add(bid)
    db.session.commit()
    return jsonify(message='Bid submitted', bid_id=bid.id)

# ---- Client: list bids ----
@app.route('/clients/<int:cid>/requests/<int:rid>/bids', methods=['GET'])
def list_bids(cid, rid):
    _ = Client.query.get_or_404(cid)
    req = CodeRequest.query.get_or_404(rid)
    bids = Bid.query.filter_by(request_id=rid).all()
    return jsonify([ {'id': b.id,'provider_id': b.provider_id, 'price': b.price, 'accepted': b.accepted, 'request_id': rid} for b in bids ])

# ---- Client: accept bid ----
@app.route('/clients/<int:cid>/requests/<int:rid>/bids/<int:bid_id>/accept', methods=['POST'])
def accept_bid(cid, rid, bid_id):
    _ = Client.query.get_or_404(cid)
    req = CodeRequest.query.get_or_404(rid)
    bid = Bid.query.get_or_404(bid_id)
    # mark winner
    bid.accepted = True
    req.status = 'SCHEDULED'
    # mark provider busy
    prov = HPCProvider.query.get(bid.provider_id)
    prov.available = False
    db.session.commit()
    # (Later: enqueue job for execution)
    return jsonify(message='Bid accepted and job scheduled', provider_id=prov.id)

@app.route('/execution/pending', methods=['GET'])
def get_pending_jobs():
    """
    Returns all requests in status=SCHEDULED with their code_text
    and assigned provider_id.
    """
    jobs = CodeRequest.query.filter_by(status='SCHEDULED').all()
    return jsonify([
        {
            'request_id': job.id,
            'provider_id': Bid.query.filter_by(request_id=job.id, accepted=True).first().provider_id,
            'code_text': job.code_text
        }
        for job in jobs
    ])

@app.route('/execution/results', methods=['POST'])
def post_job_result():
    """
    Receives { request_id, provider_id, output } and:
      - updates CodeRequest.result_output
      - sets status='DONE'
      - marks provider.available=True
    """
    data = request.json
    rid = data['request_id']
    pid = data['provider_id']
    output = data['output']

    # fetch and update
    job = CodeRequest.query.get_or_404(rid)
    prov = HPCProvider.query.get_or_404(pid)

    job.result_output = output
    job.status = 'DONE'
    prov.available = True
    db.session.commit()

    return jsonify(
        message='Result received',
        request_id=rid,
        completed_at=datetime.datetime.utcnow().isoformat() + 'Z'
    )

# ---- Client: list all requests and their status/results ----
@app.route('/clients/<int:cid>/requests', methods=['GET'])
def list_client_requests(cid):
    # ensure client exists
    _ = Client.query.get_or_404(cid)

    reqs = CodeRequest.query.filter_by(client_id=cid).all()
    return jsonify([
        {
            'id':            r.id,
            'cores':         r.cores,
            'clock_speed':   r.clock_speed,
            'memory':        r.memory,
            'status':        r.status,
            'result_output': r.result_output
        }
        for r in reqs
    ])

# ---- Provider: logout (mark unavailable) ----
@app.route('/providers/<int:pid>/logout', methods=['POST'])
def provider_logout(pid):
    prov = HPCProvider.query.get_or_404(pid)
    prov.available = False
    db.session.commit()
    return jsonify(message='Provider logged out and unavailable')

# ---- Provider: get current availability & job ----
@app.route('/providers/<int:pid>/status', methods=['GET'])
def provider_status(pid):
    prov = HPCProvider.query.get_or_404(pid)

    # Join Bid and CodeRequest; pick the latest accepted & scheduled
    job_entry = (
        db.session.query(Bid, CodeRequest)
        .join(CodeRequest, Bid.request_id == CodeRequest.id)
        .filter(
            Bid.provider_id == pid,
            Bid.accepted == True,
            CodeRequest.status == 'SCHEDULED'
        )
        .order_by(CodeRequest.id.desc())
        .first()
    )

    current_job = None
    if job_entry:
        _, req = job_entry  # unpack (Bid, CodeRequest)
        current_job = {
            'request_id':  req.id,
            'client_id':   req.client_id,
            'cores':       req.cores,
            'clock_speed': req.clock_speed,
            'memory':      req.memory,
            'code_text':   req.code_text  # include the submitted C code
        }

    return jsonify({
        'provider_id': pid,
        'available':   prov.available,
        'current_job': current_job
    })
# ---- (Future) Endpoint to push back job results ----

if __name__ == '__main__':
    app.run(port=8000, debug=True)

from marshmallow import Schema, fields

class LoginSchema(Schema):
    id = fields.Integer(required=True)
    user_type = fields.String(required=True, validate=lambda s: s in ('client','provider'))

class SpecUploadSchema(Schema):
    id = fields.Integer(required=True)
    cores = fields.Integer(required=True)
    clock_speed = fields.Float(required=True)
    memory = fields.Integer(required=True)

class CodeSubmitSchema(Schema):
    client_id = fields.Integer(required=True)
    cores = fields.Integer(required=True)
    clock_speed = fields.Float(required=True)
    memory = fields.Integer(required=True)
    code_text = fields.String(required=True)

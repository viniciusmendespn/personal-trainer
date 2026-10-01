"""Verifica o contrato real boto3, além do fake dos testes de serviços."""
from unittest.mock import Mock

import boto3
import pytest
from botocore.stub import Stubber

from app.config import settings
from app.repositories import dynamo_repo as repo


def test_transaction_serializes_once_and_uses_one_request(monkeypatch):
    client = boto3.client('dynamodb', region_name='us-east-1',
                          aws_access_key_id='test', aws_secret_access_key='test')
    monkeypatch.setattr(repo, '_transaction_client', client)
    expected = {'TransactItems': [{'Put': {
        'TableName': settings.table_name,
        'Item': {'PK': {'S': 'AL#a'}, 'SK': {'S': 'TREINO#t'}, 'carga': {'N': '12.5'}},
        'ConditionExpression': 'attribute_not_exists(PK)',
    }}, {'Update': {
        'TableName': settings.table_name,
        'Key': {'PK': {'S': 'AL#a'}, 'SK': {'S': 'PROGRAMA#REVISAO'}},
        'UpdateExpression': 'SET #r = :r',
        'ExpressionAttributeNames': {'#r': 'revisao'},
        'ExpressionAttributeValues': {':r': {'N': '1'}},
    }}]}
    with Stubber(client) as stub:
        stub.add_response('transact_write_items', {}, expected)
        repo.transact_write([
            {'Put': {'Item': {'PK': 'AL#a', 'SK': 'TREINO#t', 'carga': 12.5},
                     'ConditionExpression': 'attribute_not_exists(PK)'}},
            {'Update': {'Key': {'PK': 'AL#a', 'SK': 'PROGRAMA#REVISAO'},
                        'UpdateExpression': 'SET #r = :r', 'ExpressionAttributeNames': {'#r': 'revisao'},
                        'ExpressionAttributeValues': {':r': 1}}},
        ])
        stub.assert_no_pending_responses()


def test_transaction_limits_are_checked_before_calling_aws(monkeypatch):
    client = Mock()
    monkeypatch.setattr(repo, '_transaction_client', client)
    actions = [{'Delete': {'Key': {'PK': 'AL#a', 'SK': str(i)}}} for i in range(101)]
    with pytest.raises(repo.TransactionTooLarge): repo.transact_write(actions)
    with pytest.raises(repo.TransactionTooLarge):
        repo.transact_write([{'Put': {'Item': {'PK': 'p', 'SK': 's', 'text': 'x' * 400_000}}}])
    client.transact_write_items.assert_not_called()


def test_transaction_cannot_write_same_key_twice(monkeypatch):
    client = Mock()
    monkeypatch.setattr(repo, '_transaction_client', client)
    with pytest.raises(ValueError):
        repo.transact_write([{'Delete': {'Key': {'PK': 'p', 'SK': 's'}}}, {'Put': {'Item': {'PK': 'p', 'SK': 's'}}}])
    client.transact_write_items.assert_not_called()


def test_conditional_failure_is_a_conflict(monkeypatch):
    client = boto3.client('dynamodb', region_name='us-east-1',
                          aws_access_key_id='test', aws_secret_access_key='test')
    monkeypatch.setattr(repo, '_transaction_client', client)
    with Stubber(client) as stub:
        stub.add_client_error('transact_write_items', service_error_code='TransactionCanceledException',
            modeled_fields={'CancellationReasons': [{'Code': 'ConditionalCheckFailed'}]})
        with pytest.raises(repo.TransactionConflict):
            repo.transact_write([{'Delete': {'Key': {'PK': 'p', 'SK': 's'}}}])


def test_query_pk_reads_all_pages(monkeypatch):
    table = Mock()
    table.query.side_effect = [{'Items': [{'PK': 'p', 'SK': '1'}], 'LastEvaluatedKey': {'PK': 'p', 'SK': '1'}},
                               {'Items': [{'PK': 'p', 'SK': '2'}]}]
    monkeypatch.setattr(repo, '_get_table', lambda: table)
    assert len(repo.query_pk('p', consistent=True)) == 2
    assert table.query.call_args_list[1].kwargs['ExclusiveStartKey'] == {'PK': 'p', 'SK': '1'}

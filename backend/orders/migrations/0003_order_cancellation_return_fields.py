from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('confirmed', 'Confirmed'),
                    ('processing', 'Processing'),
                    ('shipped', 'Shipped'),
                    ('out_for_delivery', 'Out for Delivery'),
                    ('delivered', 'Delivered'),
                    ('cancelled', 'Cancelled'),
                    ('return_requested', 'Return Requested'),
                    ('returned', 'Returned'),
                ],
                db_index=True,
                default='pending',
                max_length=30
            ),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_method',
            field=models.CharField(default='Cash on Delivery', max_length=50),
        ),
        migrations.AddField(
            model_name='order',
            name='tax',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=12),
        ),
        migrations.AddField(
            model_name='order',
            name='cancellation_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='order',
            name='cancelled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='return_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='order',
            name='return_requested_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='product_image',
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='is_cancelled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='cancellation_reason',
            field=models.TextField(blank=True),
        ),
    ]
